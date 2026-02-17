const mongoose = require('mongoose');

const typingErrorSchema = new mongoose.Schema({
    key: { type: String, required: true },
    expected: { type: String, required: true },
    position: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

const keystrokeDataSchema = new mongoose.Schema({
    key: { type: String, required: true },
    count: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
});

const fingerStatsSchema = new mongoose.Schema({
    correct: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
});

const practiceResultSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true, index: true },
    difficulty: { type: String, default: 'medium' },
    mode: { type: String, enum: ['standard', 'simulation'], default: 'standard' },
    
    duration: { type: Number, required: true },
    wpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    totalKeystrokes: { type: Number, required: true },
    correctKeystrokes: { type: Number, required: true },
    errorCount: { type: Number, required: true },
    
    passageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Passage' },
    passageLength: { type: Number },
    
    errors: [typingErrorSchema],
    keystrokes: [keystrokeDataSchema],
    
    fingerStats: {
        leftPinky: fingerStatsSchema,
        leftRing: fingerStatsSchema,
        leftMiddle: fingerStatsSchema,
        leftIndex: fingerStatsSchema,
        rightIndex: fingerStatsSchema,
        rightMiddle: fingerStatsSchema,
        rightRing: fingerStatsSchema,
        rightPinky: fingerStatsSchema,
        thumbs: fingerStatsSchema
    },
    
    drillType: { type: String, enum: ['home', 'top', 'bottom', 'numbers', 'words', 'custom', null] },
    drillRepetitions: { type: Number },
    
    completedAt: { type: Date, default: Date.now, index: true }
});

practiceResultSchema.index({ user: 1, category: 1, completedAt: -1 });
practiceResultSchema.index({ user: 1, completedAt: -1 });

module.exports = mongoose.model('PracticeResult', practiceResultSchema);
