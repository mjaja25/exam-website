const TestResult = require('../models/TestResult');
const LetterQuestion = require('../models/LetterQuestion');
const ExcelQuestion = require('../models/ExcelQuestion');
const aiGradingService = require('../services/aiGradingService');

const Settings = require('../models/Settings');

exports.submitTyping = async (req, res) => {
    try {
        // Extract raw data
        const { sessionId, testPattern, typingDuration, totalChars, correctChars, errorCount, typingErrorDetails } = req.body;
        const userId = req.userId;

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required.' });
        }

        // --- SERVER SIDE GRADING LOGIC ---
        
        // 1. Fetch Dynamic Settings
        let settings = await Settings.findOne({ key: 'global_exam_config' });
        if (!settings) settings = new Settings();

        // 2. Determine Pattern Config
        const isNewPattern = testPattern === 'new_pattern';
        const config = isNewPattern ? settings.typing.newPattern : settings.typing.standard;
        
        // Fallbacks if config is missing (backward compatibility)
        const MAX_MARKS = config.maxMarks || (isNewPattern ? 30 : 20);
        const TARGET_WPM = config.targetWPM || (isNewPattern ? 40 : 35);
        const MIN_ACCURACY = config.minAccuracy || 90;
        const PENALTY = config.penalty || 2;
        const BONUS = config.bonus || 1;

        // 3. Sanitize Inputs
        const safeTotalChars = parseInt(totalChars) || 0;
        const safeCorrectChars = parseInt(correctChars) || 0;
        const safeDuration = Math.max(1, parseFloat(typingDuration) || (config.duration || 300));

        // 4. Calculate Net WPM
        // Formula: (Correct Characters / 5) / (Time in Minutes)
        const calculatedWPM = Math.round((safeCorrectChars / 5) / (safeDuration / 60));

        // 5. Calculate Accuracy
        let calculatedAccuracy = 0;
        if (safeTotalChars > 0) {
            calculatedAccuracy = Math.round((safeCorrectChars / safeTotalChars) * 100);
        }

        // 6. Calculate Marks based on New Criteria
        let typingScore = 0;

        if (calculatedAccuracy < MIN_ACCURACY) {
            // Disqualified
            typingScore = 0;
        } else {
            // Base Score based on Speed
            // (Net WPM / Target WPM) * Max Marks
            let rawScore = (calculatedWPM / TARGET_WPM) * MAX_MARKS;
            
            // Apply Penalty (90% <= Acc < 95%)
            if (calculatedAccuracy < 95) {
                rawScore -= PENALTY;
            }

            // Apply Bonus (100% Acc)
            if (calculatedAccuracy === 100) {
                rawScore += BONUS;
            }

            // Clamp Score (0 to Max Marks)
            typingScore = Math.max(0, Math.min(MAX_MARKS, Math.round(rawScore)));
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
                accuracy: calculatedAccuracy,
                qualified: calculatedAccuracy >= MIN_ACCURACY
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

        // --- UNIFIED UPDATE & COMPLETION ---
        const existingRecord = await TestResult.findOne({ sessionId, user: userId });
        if (!existingRecord) return res.status(404).json({ message: "Test Session not found." });

        if (existingRecord.status === 'completed') {
            return res.status(400).json({ message: "Test already completed." });
        }

        // Use Service for Grading
        const gradeResult = await aiGradingService.gradeExcel(req.file.path, originalQuestion.solutionFilePath, originalQuestion.questionName);

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
