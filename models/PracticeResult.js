const mongoose = require('mongoose');

const practiceResultSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true, index: true },
    difficulty: { type: String, default: 'All' },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    completedAt: { type: Date, default: Date.now, index: true }
});

// Compound index for efficient user stats queries
practiceResultSchema.index({ user: 1, category: 1, completedAt: -1 });

module.exports = mongoose.model('PracticeResult', practiceResultSchema);
