const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: 'global_exam_config' // Single document pattern
    },
    typing: {
        wpmThreshold: { type: Number, default: 35 }, // Score multiplier base
        durationSeconds: { type: Number, default: 300 }, // 5 minutes
        durationSecondsNewPattern: { type: Number, default: 600 } // 10 minutes
    },
    exam: {
        maxTypingMarksStandard: { type: Number, default: 20 },
        maxTypingMarksNew: { type: Number, default: 30 },
        excelMcqTimerSeconds: { type: Number, default: 300 }
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
