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

// GET passages with pagination, search, and filter
exports.getPassages = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1;
        const search = req.query.search || '';
        const difficulty = req.query.difficulty || '';

        const filter = {};
        if (search) {
            filter.content = { $regex: search, $options: 'i' };
        }
        if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
            filter.difficulty = difficulty;
        }

        const total = await Passage.countDocuments(filter);
        const passages = await Passage.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            passages,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Admin fetch passages error:', error);
        res.status(500).json({ message: 'Server error fetching passages.' });
    }
};

// DELETE passage
exports.deletePassage = async (req, res) => {
    try {
        const { id } = req.params;
        const passage = await Passage.findByIdAndDelete(id);
        if (!passage) {
            return res.status(404).json({ message: 'Passage not found.' });
        }
        res.json({ message: 'Passage deleted successfully.' });
    } catch (error) {
        console.error('Admin delete passage error:', error);
        res.status(500).json({ message: 'Server error deleting passage.' });
    }
};

// GET letter questions with pagination, search, and filter
exports.getLetterQuestions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const search = req.query.search || '';
        const category = req.query.category || '';

        const filter = {};
        if (search) {
            filter.questionText = { $regex: search, $options: 'i' };
        }
        if (category && ['formal', 'business'].includes(category)) {
            filter.category = category;
        }

        const total = await LetterQuestion.countDocuments(filter);
        const questions = await LetterQuestion.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            questions,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Admin fetch letter questions error:', error);
        res.status(500).json({ message: 'Server error fetching letter questions.' });
    }
};

// DELETE letter question
exports.deleteLetterQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await LetterQuestion.findByIdAndDelete(id);
        if (!question) {
            return res.status(404).json({ message: 'Letter question not found.' });
        }
        res.json({ message: 'Letter question deleted successfully.' });
    } catch (error) {
        console.error('Admin delete letter question error:', error);
        res.status(500).json({ message: 'Server error deleting letter question.' });
    }
};

// GET excel questions with pagination and search
exports.getExcelQuestions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const search = req.query.search || '';

        const filter = {};
        if (search) {
            filter.questionName = { $regex: search, $options: 'i' };
        }

        const total = await ExcelQuestion.countDocuments(filter);
        const questions = await ExcelQuestion.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            questions,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Admin fetch excel questions error:', error);
        res.status(500).json({ message: 'Server error fetching excel questions.' });
    }
};

// DELETE excel question
exports.deleteExcelQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await ExcelQuestion.findByIdAndDelete(id);
        if (!question) {
            return res.status(404).json({ message: 'Excel question not found.' });
        }
        res.json({ message: 'Excel question deleted successfully.' });
    } catch (error) {
        console.error('Admin delete excel question error:', error);
        res.status(500).json({ message: 'Server error deleting excel question.' });
    }
};

