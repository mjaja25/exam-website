const mongoose = require('mongoose');

const mcqSetSchema = new mongoose.Schema({
    setName: { type: String, required: true, unique: true }, // e.g., "NSSB Mock Set #1"
    questions: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'MCQQuestion',
        validate: [val => val.length === 20, 'A set must contain exactly 20 questions']
    }],
    isActive: { type: Boolean, default: true } // Toggle sets on/off
}, { timestamps: true });

module.exports = mongoose.model('MCQSet', mcqSetSchema);