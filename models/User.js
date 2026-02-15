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
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    avatar: {
        type: String, // Cloudinary URL or 'default-X' identifier
        default: null
    },
    bio: {
        type: String,
        maxLength: 150
    },
    completedMCQSets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MCQSet' }]
});

module.exports = mongoose.model('User', userSchema);