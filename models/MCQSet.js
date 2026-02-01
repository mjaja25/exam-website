const mongoose = require('mongoose');

const mcqSetSchema = new mongoose.Schema({
    setName: { 
        type: String, 
        required: true, 
        unique: true 
    },
    // We move the validation OUTSIDE the array brackets []
    questions: {
        type: [{ 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'MCQQuestion' 
        }],
        validate: {
            validator: function(val) {
                return val.length === 10; // This now correctly checks the array length
            },
            message: 'A set must contain exactly 10 questions'
        }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MCQSet', mcqSetSchema);