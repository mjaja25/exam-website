const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'is invalid']
    },
    password: {
        type: String, // Not required for Google sign-in
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows multiple users to have a null value
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    testCredits: {
        type: Number,
        default: 0
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String
    }
});

module.exports = mongoose.model('User', userSchema);