const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: 'global_exam_config'
    },
    typing: {
        standard: {
            duration: { type: Number, default: 300 }, // 5 mins
            maxMarks: { type: Number, default: 20 },
            minAccuracy: { type: Number, default: 90 }, // Disqualify below this
            penalty: { type: Number, default: 2 }, // Deduct marks for 90-95%
            bonus: { type: Number, default: 1 }, // Add marks for 100%
            targetWPM: { type: Number, default: 35 },
            allowBackspace: { type: Boolean, default: true }
        },
        newPattern: {
            duration: { type: Number, default: 600 }, // 10 mins
            maxMarks: { type: Number, default: 30 },
            minAccuracy: { type: Number, default: 90 },
            penalty: { type: Number, default: 2 },
            bonus: { type: Number, default: 1 },
            targetWPM: { type: Number, default: 40 },
            allowBackspace: { type: Boolean, default: true }
        }
    },
    exam: {
        excelMcqTimerSeconds: { type: Number, default: 300 }
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);