const TestResult = require('../models/TestResult');
const MCQQuestion = require('../models/MCQQuestion');

exports.getSessionResult = async (req, res) => {
    try {
        const result = await TestResult.findOne({
            sessionId: req.params.sessionId,
            user: req.userId
        });

        if (!result) return res.status(404).json({ message: "Result session not found." });

        // --- BRANCH A: New Pattern Logic ---
        if (result.testPattern === 'new_pattern') {
            const details = Array.isArray(result.mcqDetails) ? result.mcqDetails : [];
            const qIds = details.map(d => d.questionId).filter(id => id);

            // Fetch questions from the bank
            const questions = await MCQQuestion.find({ _id: { $in: qIds } });

            const mcqReviewData = details.map(attempt => {
                const qInfo = questions.find(q => q._id.toString() === attempt.questionId.toString());
                return {
                    questionText: qInfo ? qInfo.questionText : "This question was deleted.",
                    options: qInfo ? qInfo.options : ["N/A", "N/A", "N/A", "N/A"],
                    correctAnswer: qInfo ? qInfo.correctAnswerIndex : 0,
                    userAnswer: attempt.userAnswer ?? null
                };
            });

            return res.json({ ...result._doc, mcqReviewData });
        }

        // --- BRANCH B: Standard Pattern Logic (FIXED) ---
        // Just return the document as is. Do not try to process mcqReviewData.
        return res.json(result);

    } catch (error) {
        console.error("CRITICAL API ERROR:", error);
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
};

exports.getPercentile = async (req, res) => {
    try {
        const currentResult = await TestResult.findOne({
            sessionId: req.params.sessionId,
            user: req.userId
        });

        if (!currentResult) return res.status(404).json({ message: "Result not found" });

        // 1. Determine the pattern pool (Standard vs New)
        const pattern = currentResult.testPattern || 'standard';
        const currentScore = currentResult.totalScore || 0;

        // 2. Count ONLY participants who took the same exam pattern
        const totalInPool = await TestResult.countDocuments({
            testPattern: pattern,
            status: 'completed'
        });

        // 3. Count how many scored less than or equal to this user in that pool
        const scoredLower = await TestResult.countDocuments({
            testPattern: pattern,
            status: 'completed',
            totalScore: { $lte: currentScore }
        });

        // 4. Calculate Percentile
        const percentile = totalInPool > 0
            ? ((scoredLower / totalInPool) * 100).toFixed(1)
            : 100;

        res.json({
            percentile: parseFloat(percentile),
            totalParticipants: totalInPool,
            patternPool: pattern === 'new_pattern' ? "10+5 MCQ Pattern" : "Standard Pattern"
        });

    } catch (error) {
        console.error("Percentile Error:", error);
        res.status(500).json({ message: "Error calculating percentile" });
    }
};
