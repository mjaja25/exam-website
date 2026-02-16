const User = require('../models/User');
const TestResult = require('../models/TestResult');
const PracticeResult = require('../models/PracticeResult');
const Passage = require('../models/Passage');
const LetterQuestion = require('../models/LetterQuestion');
const ExcelQuestion = require('../models/ExcelQuestion');
const bcrypt = require('bcryptjs');
const { createDownloadUrl } = require('../utils/helpers');
const axios = require('axios');

exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const roleFilter = req.query.role || '';

        const filter = {};
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (roleFilter && ['user', 'admin'].includes(roleFilter)) {
            filter.role = roleFilter;
        }

        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires -completedMCQSets')
            .sort({ _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Admin fetch users error:', error);
        res.status(500).json({ message: 'Server error fetching users.' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }

        const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        if (existingUser) {
            const field = existingUser.email === email.toLowerCase() ? 'Email' : 'Username';
            return res.status(409).json({ message: `${field} is already taken.` });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: role === 'admin' ? 'admin' : 'user',
            isVerified: true // Admin-created accounts are pre-verified
        });
        await newUser.save();

        res.status(201).json({
            message: 'User created successfully.',
            user: { _id: newUser._id, username: newUser.username, email: newUser.email, role: newUser.role, isVerified: newUser.isVerified }
        });
    } catch (error) {
        console.error('Admin create user error:', error);
        res.status(500).json({ message: 'Server error creating user.' });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Valid role (user or admin) is required.' });
        }

        // Prevent self-demotion
        if (id === req.userId.toString() && role !== 'admin') {
            return res.status(400).json({ message: 'You cannot demote your own account.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.role = role;
        await user.save();

        res.json({ message: `User role updated to ${role}.`, user: { _id: user._id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Admin update role error:', error);
        res.status(500).json({ message: 'Server error updating role.' });
    }
};

exports.resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: `Password reset for ${user.username}.` });
    } catch (error) {
        console.error('Admin reset password error:', error);
        res.status(500).json({ message: 'Server error resetting password.' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.userId.toString()) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Cascade delete related data
        await TestResult.deleteMany({ user: id });
        await PracticeResult.deleteMany({ user: id });
        await User.findByIdAndDelete(id);

        res.json({ message: `User "${user.username}" and all their data have been deleted.` });
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ message: 'Server error deleting user.' });
    }
};

exports.getResults = async (req, res) => {
    try {
        let results = await TestResult.find({}).sort({ submittedAt: -1 }).populate('user', 'username email');
        results = results.map(r => {
            if (r.excelFilePath) {
                r.excelFilePath = createDownloadUrl(r.excelFilePath);
            }
            return r;
        });
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching results.' });
    }
};

exports.createPassage = async (req, res) => {
    try {
        const { content, difficulty } = req.body;
        if (!content) return res.status(400).json({ message: 'Passage content is required.' });
        const newPassage = new Passage({ content, difficulty });
        await newPassage.save();
        res.status(201).json({ message: 'Passage added successfully!', passage: newPassage });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding passage.' });
    }
};

exports.createLetterQuestion = async (req, res) => {
    try {
        const { questionText, category } = req.body;
        if (!questionText) return res.status(400).json({ message: 'Question text is required.' });
        const newQuestion = new LetterQuestion({ questionText, category });
        await newQuestion.save();
        res.status(201).json({ message: 'Letter question added successfully!', question: newQuestion });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding question.' });
    }
};

exports.createExcelQuestion = async (req, res) => {
    try {
        const { questionName } = req.body;
        const questionFile = req.files.questionFile[0];
        const solutionFile = req.files.solutionFile[0];

        if (!questionName || !questionFile || !solutionFile) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        const newExcelQuestion = new ExcelQuestion({
            questionName: questionName,
            questionFilePath: questionFile.path,
            solutionFilePath: solutionFile.path
        });
        await newExcelQuestion.save();
        res.status(201).json({ message: 'Excel question added successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding Excel question.' });
    }
};

exports.debugGemini = async (req, res) => {
    try {
        // We use the 'axios' instance you already have imported to call the Google Discovery API
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

        const response = await axios.get(url);

        // This will return a list of objects containing:
        // name (e.g., models/gemini-1.5-flash)
        // supportedGenerationMethods (e.g., ["generateContent", "countTokens"])
        res.json(response.data);
    } catch (error) {
        console.error("GEMINI DEBUG ERROR:", error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({
            message: "Failed to fetch Gemini models",
            details: error.response?.data || error.message
        });
    }
};

exports.debugKey = (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({
        exists: !!key,
        length: key ? key.length : 0,
        // Shows the first 4 characters to confirm it's the NEW key
        prefix: key ? key.substring(0, 4) : "none"
    });
};
