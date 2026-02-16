// -------------------
//  APP CONFIGURATION
//  Separated from server.js for testability
// -------------------
require('dotenv').config();
require('./passport-setup');
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// -------------------
//  MIDDLEWARE SETUP
// -------------------
app.set('trust proxy', 1);

// 1. HELMET SECURITY HEADERS
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://code.jquery.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
            connectSrc: ["'self'", "https://api.sendgrid.com", "https://generativelanguage.googleapis.com"],
            frameSrc: ["'self'"],
        },
    },
}));

// 2. RATE LIMITING
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." }
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many login attempts, please try again later." }
});
app.use('/api/auth/', authLimiter);

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: "Too many password reset requests. Please check your email." }
});
app.use('/api/auth/forgot-password', passwordResetLimiter);

// 3. GENERAL MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// -------------------
//  ROUTE IMPORTS
// -------------------
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const leaderboardRoutes = require('./routes/leaderboard');
const examRoutes = require('./routes/exam');
const mcqRoutes = require('./routes/mcq');
const practiceRoutes = require('./routes/practice');
const adminRoutes = require('./routes/admin');
const contentRoutes = require('./routes/content');
const resultRoutes = require('./routes/result');
const statsRoutes = require('./routes/stats');
const feedbackRoutes = require('./routes/feedback');
const settingsRoutes = require('./routes/settings');

// -------------------
//  API ROUTES
// -------------------

// General
app.get('/', (req, res) => { res.redirect('/login.html') });

// Auth & User
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Features
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api', examRoutes);
app.use('/api', mcqRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// New Modular Routes
app.use('/api', contentRoutes);
app.use('/api', resultRoutes);
app.use('/api', statsRoutes);
app.use('/api', feedbackRoutes);

// -------------------
//  GLOBAL ERROR HANDLER
// -------------------
const multer = require('multer');
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File is too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
    }

    if (err && err.message && (err.message.includes('Only') || err.message.includes('allowed'))) {
        return res.status(400).json({ message: err.message });
    }

    res.status(err.status || 500).json({
        message: err.message || 'An internal server error occurred.',
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
});

module.exports = app;
