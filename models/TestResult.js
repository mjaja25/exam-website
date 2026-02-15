const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
    sessionId: { type: String, index: true, unique: true }, // Ensure one doc per session
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Test Metadata
    testPattern: {
        type: String,
        enum: ['standard', 'new_pattern'],
        default: 'standard'
    },
    attemptMode: {
        type: String,
        enum: ['exam', 'practice'],
        default: 'exam'
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed'],
        default: 'in-progress'
    },
    submittedAt: { type: Date, default: Date.now },

    // ⌨ Stage 1: Typing Fields
    wpm: { type: Number },
    accuracy: { type: Number },
    typingScore: { type: Number, index: true },
    // Detailed Typing Metrics for AI Analysis
    typingDuration: Number,
    totalChars: Number,
    correctChars: Number,
    errorCount: Number,
    typingErrorDetails: String, // JSON string of error patterns

    // ✉ Stage 2: Letter Fields (Standard Pattern)
    letterContent: String,
    letterScore: { type: Number, default: 0 },
    letterFeedback: String,

    // 📊 Stage 3: Excel/MCQ Fields
    mcqScore: { type: Number, default: 0 },

    // >>> THIS WAS MISSING <<<
    mcqDetails: [
        {
            questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQQuestion' },
            userAnswer: { type: Number } // The index (0-3) of the option selected
        }
    ],
    // >>> END OF FIX <<<

    excelScore: { type: Number, default: 0 },
    excelFilePath: String, // Path for Cloudinary uploads
    excelFeedback: String,

    // 🏆 Final Score
    totalScore: { type: Number, default: 0, index: true }
});

module.exports = mongoose.model('TestResult', testResultSchema);