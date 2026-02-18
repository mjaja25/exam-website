const MCQQuestion = require('../models/MCQQuestion');
const MCQSet = require('../models/MCQSet');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const fs = require('fs');
const csv = require('csv-parser');

// --- User / Exam Routes ---

exports.getNextSet = async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        // 1. Find all active sets that the user has NOT completed yet
        let availableSets = await MCQSet.find({
            _id: { $nin: user.completedMCQSets },
            isActive: true
        }).select('_id'); // We only fetch IDs first to keep it fast

        // 2. AUTO-RESET: If the user has completed everything, clear their history
        if (availableSets.length === 0) {
            console.log(`User ${user.email} has seen all sets. Resetting cycle...`);
            user.completedMCQSets = [];
            await user.save();

            // Re-fetch all currently active sets
            availableSets = await MCQSet.find({ isActive: true }).select('_id');
        }

        // 3. Check if there are actually any sets in the system at all
        if (availableSets.length === 0) {
            return res.status(404).json({ message: "No active mock sets are available in the system." });
        }

        // 4. RANDOMIZER: Pick a random ID from the list of available sets
        const randomIndex = Math.floor(Math.random() * availableSets.length);
        const randomSetId = availableSets[randomIndex]._id;

        // 5. Fetch the full set data including questions
        const nextSet = await MCQSet.findById(randomSetId).populate('questions');

        res.json({
            setId: nextSet._id,
            setName: nextSet.setName,
            questions: nextSet.questions
        });
    } catch (error) {
        console.error("Random Set Fetch Error:", error);
        res.status(500).json({ message: "Server error fetching exam set." });
    }
};

exports.submitExcelMCQ = async (req, res) => {
    try {
        const { sessionId, setId, answers } = req.body;
        const userId = req.userId;

        if (!sessionId || !setId || !answers) {
            return res.status(400).json({ message: 'Session ID, set ID, and answers are required.' });
        }

        // answers is an object keyed by question ID (e.g. { "abc123": 2, "def456": 0 })
        if (typeof answers !== 'object' || Array.isArray(answers)) {
            return res.status(400).json({ message: 'Answers must be an object keyed by question ID.' });
        }

        // 1. Fetch curated set and calculate correct answers (server-side grading)
        const examSet = await MCQSet.findById(setId).populate('questions');
        if (!examSet) return res.status(404).json({ message: "Set not found." });

        let correctCount = 0;
        examSet.questions.forEach((q) => {
            // Use .toString() to compare ObjectId with string key from client
            const userAnswer = answers[q._id.toString()];
            if (userAnswer !== undefined && parseInt(userAnswer) === q.correctAnswerIndex) {
                correctCount++;
            }
        });

        // 2. Score Calculation: 10 questions * 2 marks = 20 Marks
        const mcqMarks = correctCount * 2;

        // 3. Fetch previous typing marks to get the total (30 + 20 = 50)
        const typingResult = await TestResult.findOne({ sessionId, user: userId });
        if (!typingResult) {
            return res.status(404).json({ message: "Test session not found. Please start the exam from the beginning." });
        }

        if (typingResult.status === 'completed') {
            return res.status(400).json({ message: "Test already completed." });
        }

        const finalTotal = (parseFloat(typingResult.typingScore) || 0) + mcqMarks;

        // 4. Update Result and mark as completed
        await TestResult.findOneAndUpdate(
            { sessionId, user: userId },
            {
                mcqScore: mcqMarks,
                totalScore: finalTotal,
                status: 'completed',
                // Save raw details so the review page can show Green/Red highlights
                mcqDetails: Object.keys(answers).map(qId => ({
                    questionId: qId,
                    userAnswer: parseInt(answers[qId])
                }))
            },
            { new: true }
        );

        // 5. Mark this set as completed for the user (prevents repeat)
        await User.findByIdAndUpdate(userId, {
            $addToSet: { completedMCQSets: setId }
        });

        res.json({
            success: true,
            mcqScore: mcqMarks,
            totalScore: finalTotal,
            redirectUrl: `/results-new.html?sessionId=${sessionId}`
        });
    } catch (error) {
        console.error("MCQ Submit Error:", error);
        res.status(500).json({ message: "Error saving MCQ results." });
    }
};

exports.getPracticeQuestions = async (req, res) => {
    try {
        const { category } = req.params;
        const { difficulty } = req.query;

        // Build match filter
        const matchFilter = {};
        if (category !== 'All') matchFilter.category = category;
        if (difficulty && difficulty !== 'All') matchFilter.difficulty = difficulty;

        const questions = await MCQQuestion.aggregate([
            { $match: matchFilter },
            { $sample: { size: 10 } }
        ]);
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: "Error loading practice questions" });
    }
};

// --- Admin Routes ---

exports.getMCQQuestions = async (req, res) => {
    try {
        const { page = 1, limit = 50, search, category, difficulty } = req.query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (search) filter.questionText = { $regex: search, $options: 'i' };
        if (category) filter.category = category;
        if (difficulty) filter.difficulty = difficulty;

        const total = await MCQQuestion.countDocuments(filter);
        const questions = await MCQQuestion.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        res.json({
            questions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching question bank.' });
    }
};

exports.createMCQQuestion = async (req, res) => {
    try {
        const { questionText, options, correctAnswerIndex, category, difficulty, correctExplanation } = req.body;

        let imageUrl = '';
        if (req.file) {
            imageUrl = req.file.path;
        }

        const newQuestion = new MCQQuestion({
            questionText,
            options, // If sending as FormData, ensure this is parsed correctly (e.g. JSON.parse if stringified)
            correctAnswerIndex,
            category: category || 'General',
            difficulty,
            correctExplanation,
            imageUrl
        });
        await newQuestion.save();
        res.status(201).json({ message: 'Question saved to bank!', question: newQuestion });
    } catch (error) {
        console.error("Add MCQ Error:", error);
        res.status(500).json({ message: 'Error saving question.' });
    }
};

exports.createMCQSet = async (req, res) => {
    try {
        const { setName, questions } = req.body; // 'questions' must match 'admin.js'

        const newSet = new MCQSet({
            setName,
            questions, // This matches the array of 10 IDs
            isActive: true
        });

        await newSet.save();
        res.status(201).json({ success: true, message: 'Set created!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMCQSets = async (req, res) => {
    try {
        const sets = await MCQSet.find({}).populate('questions', 'questionText category').sort({ createdAt: -1 });
        res.json(sets);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sets.' });
    }
};

exports.updateMCQQuestion = async (req, res) => {
    try {
        const { questionText, options, correctAnswerIndex, category, difficulty, correctExplanation } = req.body;

        const updateData = {
            questionText,
            options,
            correctAnswerIndex,
            category,
            difficulty,
            correctExplanation
        };

        if (req.file) {
            updateData.imageUrl = req.file.path;
        }

        const updated = await MCQQuestion.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Question not found.' });
        res.json({ success: true, message: 'Question updated!', question: updated });
    } catch (error) {
        res.status(500).json({ message: 'Error updating question: ' + error.message });
    }
};

exports.deleteMCQQuestion = async (req, res) => {
    try {
        const deleted = await MCQQuestion.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Question not found.' });
        // Also remove this question from any sets that reference it
        await MCQSet.updateMany({}, { $pull: { questions: req.params.id } });
        res.json({ success: true, message: 'Question deleted!' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting question.' });
    }
};

exports.deleteMCQSet = async (req, res) => {
    try {
        const deleted = await MCQSet.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Set not found.' });
        res.json({ success: true, message: 'Set deleted!' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting set.' });
    }
};

exports.toggleMCQSet = async (req, res) => {
    try {
        const set = await MCQSet.findById(req.params.id);
        if (!set) return res.status(404).json({ message: 'Set not found.' });
        set.isActive = !set.isActive;
        await set.save();
        res.json({ success: true, isActive: set.isActive, message: `Set ${set.isActive ? 'activated' : 'deactivated'}.` });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling set.' });
    }
};

exports.bulkUploadMCQ = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded." });
    }

    const results = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
            // Transform CSV row into our Database Model format
            results.push({
                questionText: data.questionText,
                options: [data.optionA, data.optionB, data.optionC, data.optionD],
                correctAnswerIndex: parseInt(data.correctAnswerIndex),
                category: data.category,
                difficulty: data.difficulty || 'Medium',
                correctExplanation: data.correctExplanation || ''
            });
        })
        .on('end', async () => {
            try {
                if (results.length === 0) {
                    fs.unlinkSync(filePath);
                    return res.status(400).json({ message: "CSV file is empty or formatted incorrectly." });
                }

                // Bulk insert into MongoDB
                const docs = await MCQQuestion.insertMany(results);

                // Delete the temporary file to keep your server clean
                fs.unlinkSync(filePath);

                res.json({ message: "Upload successful", count: docs.length });
            } catch (err) {
                // If DB fails, still delete the temp file
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                res.status(500).json({ message: "Database Error during bulk insert", error: err.message });
            }
        })
        .on('error', (err) => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            res.status(500).json({ message: "Error parsing CSV file", error: err.message });
        });
};
