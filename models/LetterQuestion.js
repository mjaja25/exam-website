// In models/LetterQuestion.js
const mongoose = require('mongoose');

const letterQuestionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    category: {
        type: String,
        enum: ['formal', 'informal', 'business'],
        default: 'formal'
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('LetterQuestion', letterQuestionSchema);