const mongoose = require('mongoose');

const mcqQuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }], // Array of 4 options
    correctAnswerIndex: { type: Number, required: true }, // 0 to 3
    correctExplanation: { type: String, default: '' }, // Why the correct answer is right
    category: {
        type: String,
        required: true,
        enum: ['Formulas', 'Shortcuts', 'Cell Referencing', 'Basic Operations', 'Formatting', 'Charts', 'Pivot Tables', 'Data Validation', 'Conditional Formatting']
    },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    imageUrl: { type: String } // Optional image for the question
}, { timestamps: true });

module.exports = mongoose.model('MCQQuestion', mcqQuestionSchema);