const TestResult = require('../models/TestResult');
const LetterQuestion = require('../models/LetterQuestion');
const ExcelQuestion = require('../models/ExcelQuestion');
const aiGradingService = require('../services/aiGradingService');

exports.submitTyping = async (req, res) => {
    try {
        const { wpm, accuracy, sessionId, testPattern, typingDuration, totalChars, correctChars, errorCount, typingErrorDetails } = req.body;
        const userId = req.userId;

        if (!wpm || !accuracy || !sessionId) {
            return res.status(400).json({ message: 'WPM, accuracy, and session ID are required.' });
        }

        // Calculate marks: New Pattern = 30 max, Standard = 20 max
        let typingScore = 0;
        if (testPattern === 'new_pattern') {
            typingScore = Math.min(30, Math.round((wpm / 35) * 30));
        } else {
            typingScore = Math.min(20, Math.round((wpm / 35) * 20));
        }

        // Create or Update the TestResult
        const result = await TestResult.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            {
                wpm,
                accuracy,
                typingScore,
                testPattern,
                // Save detailed metrics for AI Analysis
                typingDuration,
                totalChars,
                correctChars,
                errorCount,
                typingErrorDetails,
                status: 'in-progress' // Still waiting for MCQ or Letter
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, typingScore: typingScore });
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
