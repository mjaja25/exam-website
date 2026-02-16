const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
        index: true
    },
    password: {
        type: String, // Not required for Google sign-in
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple users to have a null value
        index: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
        index: true
    },
    testCredits: {
        type: Number,
        default: 0
    },
    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    verificationToken: {
        type: String,
        index: true
    },
    resetPasswordToken: {
        type: String,
        index: true
    },
    resetPasswordExpires: {
        type: Date,
        index: true
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
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
