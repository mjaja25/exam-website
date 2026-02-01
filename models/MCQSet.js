const mongoose = require('mongoose');

const mcqSetSchema = new mongoose.Schema({
    setName: { type: String, required: true, unique: true },
    questions: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'MCQQuestion',
        // Change this from 20 to 10
        validate: [val => val.length === 10, 'A set must contain exactly 10 questions']
    }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MCQSet', mcqSetSchema);