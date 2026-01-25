const mongoose = require('mongoose');

const mcqQuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }], // Array of 4 options
    correctAnswerIndex: { type: Number, required: true }, // 0 to 3
    category: { 
        type: String, 
        required: true, 
        enum: ['Formulas', 'Shortcuts', 'Cell Referencing', 'Basic Operations', 'Formatting'] 
    },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' }
}, { timestamps: true });

module.exports = mongoose.model('MCQQuestion', mcqQuestionSchema);