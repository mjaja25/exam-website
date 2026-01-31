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

    // ⌨ Stage 1: Typing Fields
    wpm: { type: Number },
    accuracy: { type: Number },
    typingScore: { type: Number, index: true },

    // ✉ Stage 2: Letter Fields (Standard Pattern)
    letterContent: String,
    letterScore: { type: Number, default: 0 },
    letterFeedback: String,

    // 📊 Stage 3: Excel/MCQ Fields
    // (MCQ for New Pattern | Excel for Standard)
    mcqScore: { type: Number, default: 0 }, 
    excelScore: { type: Number, default: 0 },
    excelFilePath: String, // Path for Cloudinary uploads
    excelFeedback: String,

    // 🏆 Final Aggregate
    totalScore: { type: Number, index: true, default: 0 },
    
    submittedAt: { type: Date, default: Date.now }
});

// Compound Index: Helps finding a user's specific session quickly
testResultSchema.index({ user: 1, sessionId: 1 });

module.exports = mongoose.model('TestResult', testResultSchema);