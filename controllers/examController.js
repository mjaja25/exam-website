const TestResult = require('../models/TestResult');
const LetterQuestion = require('../models/LetterQuestion');
const ExcelQuestion = require('../models/ExcelQuestion');
const aiGradingService = require('../services/aiGradingService');

const Settings = require('../models/Settings');

exports.submitTyping = async (req, res) => {
    try {
        // Extract raw data, ignoring client-calculated wpm/accuracy
        const { sessionId, testPattern, typingDuration, totalChars, correctChars, errorCount, typingErrorDetails } = req.body;
        const userId = req.userId;

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required.' });
        }

        // --- SERVER SIDE GRADING LOGIC ---
        
        // 1. Fetch Dynamic Settings
        let settings = await Settings.findOne({ key: 'global_exam_config' });
        if (!settings) settings = new Settings(); // Use defaults if not found

        const MAX_WPM_THRESHOLD = settings.typing.wpmThreshold;
        const MAX_MARKS_STANDARD = settings.exam.maxTypingMarksStandard;
        const MAX_MARKS_NEW = settings.exam.maxTypingMarksNew;

        // 2. Sanitize Inputs
        const safeTotalChars = parseInt(totalChars) || 0;
        const safeCorrectChars = parseInt(correctChars) || 0;
        // Ensure duration is at least 1 second to avoid Infinity, default to 300s if missing
        const safeDuration = Math.max(1, parseFloat(typingDuration) || 300);

        // 3. Calculate WPM
        // Formula: (Correct Characters / 5) / (Time in Minutes)
        const calculatedWPM = Math.round((safeCorrectChars / 5) / (safeDuration / 60));

        // 4. Calculate Accuracy
        // Formula: (Correct / Total) * 100
        let calculatedAccuracy = 0;
        if (safeTotalChars > 0) {
            calculatedAccuracy = Math.round((safeCorrectChars / safeTotalChars) * 100);
        }

        // 5. Calculate Marks
        let typingScore = 0;

        if (testPattern === 'new_pattern') {
            // New Pattern
            typingScore = Math.min(MAX_MARKS_NEW, Math.round((calculatedWPM / MAX_WPM_THRESHOLD) * MAX_MARKS_NEW));
        } else {
            // Standard Pattern
            typingScore = Math.min(MAX_MARKS_STANDARD, Math.round((calculatedWPM / MAX_WPM_THRESHOLD) * MAX_MARKS_STANDARD));
        }

        // Create or Update the TestResult
        const result = await TestResult.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            {
                wpm: calculatedWPM,
                accuracy: calculatedAccuracy,
                typingScore,
                testPattern,
                // Save detailed metrics for AI Analysis
                typingDuration: safeDuration,
                totalChars: safeTotalChars,
                correctChars: safeCorrectChars,
                errorCount: parseInt(errorCount) || 0,
                typingErrorDetails,
                status: 'in-progress' // Still waiting for MCQ or Letter
            },
            { upsert: true, new: true }
        );

        res.json({ 
            success: true, 
            typingScore: typingScore,
            serverCalculated: {
                wpm: calculatedWPM,
                accuracy: calculatedAccuracy
            }
        });
    } catch (error) {
        console.error("Typing Submit Error:", error);
        res.status(500).json({ message: "Error saving typing results." });
    }
};

exports.submitLetter = async (req, res) => {
    try {
        const { content, sessionId, questionId } = req.body;
        const userId = req.userId;

        if (!content || !sessionId || !questionId) {
            return res.status(400).json({ message: 'Content, session ID, and question ID are required.' });
        }

        const originalQuestion = await LetterQuestion.findById(questionId);
        if (!originalQuestion) {
            return res.status(404).json({ message: "Letter question not found" });
        }

        // Use Service for Grading
        const gradeResult = await aiGradingService.gradeLetter(content, originalQuestion.questionText);

        /* ---------- DB UPDATE ---------- */
        const updatedDoc = await TestResult.findOneAndUpdate(
            { sessionId, user: userId },
            {
                $set: {
                    letterScore: gradeResult.totalScore,
                    letterContent: content,
                    letterFeedback: gradeResult.feedback
                }
            },
            { new: true }
        );

        if (!updatedDoc) return res.status(404).json({ message: "Session not found" });

        res.json({
            success: true,
            grade: {
                score: gradeResult.totalScore,
                feedback: gradeResult.feedback
            }
        });

    } catch (error) {
        console.error("Letter Submit Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

exports.submitExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        const { sessionId, questionId } = req.body;
        const userId = req.userId;

        if (!sessionId || !questionId) {
            return res.status(400).json({ message: 'Session ID and Question ID are required.' });
        }

        const originalQuestion = await ExcelQuestion.findById(questionId);
        if (!originalQuestion) return res.status(404).json({ message: 'Excel question not found.' });

        // Use Service for Grading
        const gradeResult = await aiGradingService.gradeExcel(req.file.path, originalQuestion.solutionFilePath, originalQuestion.questionName);

        // --- UNIFIED UPDATE & COMPLETION ---
        const existingRecord = await TestResult.findOne({ sessionId, user: userId });
        if (!existingRecord) return res.status(404).json({ message: "Test Session not found." });

        const typingMarks = parseFloat(existingRecord.typingScore) || 0;
        const letterMarks = parseFloat(existingRecord.letterScore) || 0;
        const excelMarks = gradeResult.score;

        const finalTotal = typingMarks + letterMarks + excelMarks;

        await TestResult.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            {
                excelScore: excelMarks,
                excelFilePath: req.file.path, // Save the path so we can analyze it later!
                excelFeedback: gradeResult.feedback,
                totalScore: finalTotal,
                status: 'completed' // Mark as finished
            }
        );

        res.status(200).json({ message: 'Test Completed!', total: finalTotal });
    } catch (error) {
        console.error("Excel Submit Error:", error);
        res.status(500).json({ message: "Error submitting excel." });
    }
};

exports.analyzeExam = async (req, res) => {
    try {
        const { sessionId, type } = req.body;
        const userId = req.userId;

        // Fetch result (security check included: must belong to user)
        const result = await TestResult.findOne({ sessionId, user: userId });
        if (!result) return res.status(404).json({ message: "Exam session not found." });

        const analysis = await aiGradingService.analyzePerformance(result, type);

        res.json({ success: true, analysis: analysis });

    } catch (error) {
        console.error("Exam Analysis Error:", error);
        res.status(500).json({ message: "Failed to generate detailed analysis." });
    }
};
