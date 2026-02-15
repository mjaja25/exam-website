const mongoose = require('mongoose');

const mcqSetSchema = new mongoose.Schema({
    setName: { 
        type: String, 
        required: true, 
        unique: true 
    },
    questions: {
        type: [{ 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'MCQQuestion' 
        }],
        validate: {
            validator: function(val) {
                return val.length === 10;
            },
            message: 'A set must contain exactly 10 questions'
        }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MCQSet', mcqSetSchema);