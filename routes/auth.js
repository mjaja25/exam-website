const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../validation/middleware');
const {
    registerBody,
    loginBody,
    forgotPasswordBody,
    resetPasswordBody,
    verifyEmailQuery
} = require('../validation/schemas/auth');

// Auth Routes
router.post('/register', validate({ body: registerBody }), authController.register);
router.post('/login', validate({ body: loginBody }), authController.login);
router.get('/verify-email', validate({ query: verifyEmailQuery }), authController.verifyEmail);
router.get('/verify-token', authMiddleware, authController.verifyToken);

// Password Reset Routes
router.post('/forgot-password', validate({ body: forgotPasswordBody }), authController.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordBody }), authController.resetPassword);

// Google OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login.html' }), 
    authController.googleCallback
);

module.exports = router;
