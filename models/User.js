const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'is invalid']
    },
    password: { // Password is not required for Google users
        type: String,
    },
    googleId: { // Field to store the user's Google ID
        type: String,
        unique: true,
        sparse: true // Allows multiple documents to have a null value for this field
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
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