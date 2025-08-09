// In models/TestResult.js
const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
    sessionId: { type: String, index: true },
    testType: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    wpm: { type: Number },
    accuracy: { type: Number },
    content: { type: String },
    filePath: { type: String },
    score: { type: Number },
    feedback: { type: String },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestResult', testResultSchema);