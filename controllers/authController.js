const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const User = require('../models/User');

// Configure SendGrid (Ensure API Key is set in environment)
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({ message: 'Email is already registered.' });
        }
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({ message: 'Username is already taken. Please choose a different one.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = jwt.sign({ email: email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            verificationToken: verificationToken
        });
        await newUser.save();
        const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}`;
        const msg = {
            to: email,
            from: process.env.VERIFIED_SENDER_EMAIL,
            subject: 'Please Verify Your Email Address',
            html: `<p>Please click the link to verify your email: <a href="${verificationUrl}">Verify Email</a></p>`,
        };
        await sgMail.send(msg);
        res.status(201).json({ message: 'User created successfully! Please check your email to verify your account.' });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: 'An error occurred while creating the user.' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        if (!user.password) {
            return res.status(400).json({ message: 'You have previously signed in with Google. Please use the "Sign in with Google" button.' });
        }
        if (!user.isVerified) {
            return res.status(403).json({ message: 'Please verify your email address before logging in.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email, verificationToken: token });
        if (!user) {
            return res.status(400).send('<h1>Invalid or expired verification link.</h1>');
        }
        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();
        const loginToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.redirect(`/auth-success.html?token=${loginToken}`);
    } catch (error) {
        res.status(400).send('<h1>Invalid or expired verification link.</h1>');
    }
};

exports.verifyToken = (req, res) => { 
    res.status(200).json({ message: 'Token is valid.' }); 
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required.' });

        const user = await User.findOne({ email: email.toLowerCase() });

        // If no user found, still return 200 to prevent email enumeration
        if (!user) {
            return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        // Google-only user (no password set)
        if (!user.password && user.googleId) {
            return res.json({ googleOnly: true, message: 'This account uses Google Sign-In. Please use the "Sign in with Google" button to access your account.' });
        }

        // Generate reset token (1 hour expiry)
        const resetToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetUrl = `${process.env.BASE_URL}/reset-password.html?token=${resetToken}`;
        const msg = {
            to: user.email,
            from: process.env.VERIFIED_SENDER_EMAIL,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
                    <h2 style="color: #111827;">Password Reset</h2>
                    <p>You requested a password reset for your Dream Centre account.</p>
                    <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
                    <a href="${resetUrl}" style="display: inline-block; background: #f59e0b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 1rem 0;">Reset Password</a>
                    <p style="font-size: 0.85rem; color: #6b7280;">If you did not request this, you can safely ignore this email.</p>
                </div>
            `,
        };
        await sgMail.send(msg);

        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'An error occurred. Please try again later.' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required.' });
        if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
        }

        const user = await User.findOne({
            email: decoded.email,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'An error occurred. Please try again later.' });
    }
};

exports.googleCallback = (req, res) => {
    // req.user is populated by passport
    const token = jwt.sign({ userId: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.redirect(`/auth-success.html?token=${token}`);
};