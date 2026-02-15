const mongoose = require('mongoose');

const practiceResultSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    difficulty: { type: String, default: 'All' },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PracticeResult', practiceResultSchema);
