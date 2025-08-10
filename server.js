// -------------------
//  IMPORTS
// -------------------
require('./passport-setup');
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const sgMail = require('@sendgrid/mail');
const ExcelJS = require('exceljs');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const axios = require('axios');

// --- MODEL IMPORTS ---
const User = require('./models/User');
const TestResult = require('./models/TestResult');
const Passage = require('./models/Passage');
const LetterQuestion = require('./models/LetterQuestion');
const ExcelQuestion = require('./models/ExcelQuestion');

// -------------------
//  INITIALIZATIONS & CONFIGURATIONS
// -------------------
const app = express();
const PORT = process.env.PORT || 3000;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
('./passport-setup');

// -------------------
//  STORAGE & UPLOAD CONFIGURATION
// -------------------

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        // This function sets the destination folder dynamically
        let folder;
        if (req.path.includes('/admin/excel-questions')) {
            folder = 'excel_templates'; // Admin uploads go here
        } else {
            folder = 'excel_submissions'; // User submissions go here
        }
        return {
            folder: folder,
            resource_type: 'raw',
            public_id: `${path.parse(file.originalname).name}-${Date.now()}${path.extname(file.originalname)}`
        };
    },
});

// Create a single, powerful multer instance
const upload = multer({ storage: storage });

const cloudinaryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'excel_submissions', resource_type: 'raw', public_id: (req, file) => 'submission-' + Date.now() }
});
const localDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/excel_files/') },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname) }
});
const uploadToCloudinary = multer({ storage: cloudinaryStorage });
const uploadLocally = multer({ storage: localDiskStorage });

// -------------------
//  MIDDLEWARE SETUP
// -------------------
app.set('trust proxy', 1);
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

// --- Authentication Middleware ---
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decodedToken.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Authentication failed. Please log in.' });
    }
};

// --- Admin-Only Middleware ---
const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (user && user.role === 'admin') {
            next();
        } else {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error.' });
    }
};

// --- Helper Function ---
function createDownloadUrl(url) {
    if (!url || !url.includes('cloudinary')) return url;
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/fl_attachment/${parts[1]}`;
}

// -------------------
//  DATABASE CONNECTION
// -------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// -------------------
//  API ROUTES
// -------------------

// --- General Routes ---
app.get('/', (req, res) => { res.redirect('/login.html') });

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email is already registered.' });
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
        res.status(500).json({ message: 'An error occurred while creating the user.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
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
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});

app.get('/api/auth/verify-email', async (req, res) => {
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
});

app.get('/api/auth/verify-token', authMiddleware, (req, res) => { res.status(200).json({ message: 'Token is valid.' }) });
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login.html' }), (req, res) => {
    const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.redirect(`/auth-success.html?token=${token}`);
});

// --- User-Specific Routes ---
app.get('/api/user/dashboard', authMiddleware, async (req, res) => {
    try {
        // Find the user making the request
        const user = await User.findById(req.userId);
        
        // Find the results for that user
        let results = await TestResult.find({ user: req.userId }).sort({ submittedAt: -1 });

        // Modify the filePath for any Excel results before sending
        results = results.map(r => {
            if (r.testType === 'Excel' && r.filePath) {
                r.filePath = createDownloadUrl(r.filePath);
            }
            return r;
        });
        
        // Send back both the user details and their modified results
        res.json({ user: { username: user.username }, results });

    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

app.get('/api/passages/random', authMiddleware, async (req, res) => {
    try {
        const count = await Passage.countDocuments();
        const random = Math.floor(Math.random() * count);
        const passage = await Passage.findOne().skip(random);
        if (!passage) return res.status(404).json({ message: 'No passages found.' });
        res.json(passage);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching passage.' });
    }
});

app.get('/api/letter-questions/random', authMiddleware, async (req, res) => {
    try {
        const count = await LetterQuestion.countDocuments();
        const random = Math.floor(Math.random() * count);
        const question = await LetterQuestion.findOne().skip(random);
        if (!question) return res.status(404).json({ message: 'No letter questions found.' });
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching question.' });
    }
});

app.get('/api/excel-questions/random', authMiddleware, async (req, res) => {
    try {
        const count = await ExcelQuestion.countDocuments();
        const random = Math.floor(Math.random() * count);
        const question = await ExcelQuestion.findOne().skip(random); // 'question' is correctly defined here
        
        if (!question) {
            return res.status(404).json({ message: 'No excel questions found.' });
        }
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching question.' });
    }
});
app.post('/api/submit/typing', authMiddleware, async (req, res) => {
    try {
        const { wpm, accuracy, sessionId } = req.body;
        let score = 0;
        const meetsQualification = wpm >= 35 && accuracy >= 95;
        if (meetsQualification) {
            score = 10;
            score += Math.min(Math.floor((wpm - 35) / 5), 5);
            score += Math.min(Math.floor(accuracy - 95), 5);
        }
        const newResult = new TestResult({
            testType: 'Typing',
            user: req.userId,
            sessionId: sessionId,
            wpm: wpm,
            accuracy: accuracy,
            score: Math.min(score, 20)
        });
        await newResult.save();
        res.status(201).json({ message: 'Result saved successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to save result.' });
    }
});

app.post('/api/submit/letter', authMiddleware, async (req, res) => {
    try {
        const { content, sessionId, questionId } = req.body;
        const originalQuestion = await LetterQuestion.findById(questionId);
        if (!originalQuestion) return res.status(404).json({ message: 'Original question not found.' });
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const gradingPrompt = `
            Act as a strict examiner. Your entire response must be ONLY a valid JSON object.
            You are grading a formal letter written in response to: "${originalQuestion.questionText}"
            Grade out of 10 based on: Content (4 marks), Format (3 marks), Grammar & Spelling (3 marks).
            If the response is not a valid letter, score 0.
            ---
            User's Letter: "${content}"
            ---
            Return ONLY a JSON object: { "score": <number>, "feedback": "<string>" }
        `;
        const result = await model.generateContent(gradingPrompt);
        const responseText = await result.response.text();
        let grade;
        try {
            const cleanedText = responseText.replace(/```json|```/g, '').trim();
            grade = JSON.parse(cleanedText);
        } catch (parseError) {
            grade = { score: 0, feedback: "Automated grading failed due to an invalid format." };
        }
        const newResult = new TestResult({
            testType: 'Letter', user: req.userId, sessionId: sessionId, content: content, score: grade.score, feedback: grade.feedback
        });
        await newResult.save();
        res.status(201).json({ message: 'Letter graded and saved successfully!', grade: grade });
    } catch (error) {
        res.status(500).json({ message: 'Failed to grade or save letter.' });
    }
});

app.post('/api/submit/excel', authMiddleware, uploadToCloudinary.single('excelFile'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        const { sessionId, questionId } = req.body;
        const originalQuestion = await ExcelQuestion.findById(questionId);
        if (!originalQuestion) return res.status(404).json({ message: 'Excel question not found.' });

        // --- THE FIX IS HERE ---
        // 1. Download the solution file from its Cloudinary URL
        const solutionFileResponse = await axios.get(originalQuestion.solutionFilePath, { responseType: 'arraybuffer' });
        const solutionFileBuffer = Buffer.from(solutionFileResponse.data);

        // 2. Download the user's submitted file from its Cloudinary URL
        const userFileResponse = await axios.get(req.file.path, { responseType: 'arraybuffer' });
        const userFileBuffer = Buffer.from(userFileResponse.data);

        const solutionWorkbook = new ExcelJS.Workbook();
        await solutionWorkbook.xlsx.load(solutionFileBuffer);
        const solutionSheet1Data = JSON.stringify(solutionWorkbook.getWorksheet(1).getSheetValues());
        const solutionSheet2Instructions = JSON.stringify(solutionWorkbook.getWorksheet(2).getSheetValues());

        const userWorkbook = new ExcelJS.Workbook();
        await userWorkbook.xlsx.load(userFileBuffer);
        const userSheet1Data = JSON.stringify(userWorkbook.getWorksheet(1).getSheetValues());

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const gradingPrompt = `
            Act as an expert Excel grader. Your response must be ONLY a valid JSON object.
            The user was given a test named "${originalQuestion.questionName}".
            Grade the submission out of 20 based on the 5 instructions provided. Each instruction is worth 4 marks.
            ---
            GRADING RUBRIC (Instructions): ${solutionSheet2Instructions}
            ---
            CORRECT SOLUTION DATA: ${solutionSheet1Data}
            ---
            USER SUBMISSION DATA: ${userSheet1Data}
            ---
            Return ONLY a JSON object: { "score": <number_out_of_20>, "feedback": "<string_point-by-point_feedback>" }
        `;
        const result = await model.generateContent(gradingPrompt);
        const responseText = await result.response.text();
        let grade;
        try {
            const cleanedText = responseText.replace(/```json|```/g, '').trim();
            grade = JSON.parse(cleanedText);
        } catch (parseError) {
            grade = { score: 0, feedback: "Automated grading failed due to an unexpected format from the AI." };
        }
        const newResult = new TestResult({
            testType: 'Excel', user: req.userId, sessionId: sessionId, filePath: req.file.path, score: grade.score, feedback: grade.feedback
        });
        await newResult.save();
        res.status(201).json({ message: 'Excel file graded and submitted successfully!', grade: grade });
    } catch (error) {
        next(error);
    }
});

app.get('/api/results/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const results = await TestResult.find({ user: req.userId, sessionId: sessionId });
        if (!results) return res.status(404).json({ message: 'Results not found for this session.' });
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching results.' });
    }
});

app.get('/api/results/percentile/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userResults = await TestResult.find({ sessionId });
        const totalScore = userResults.reduce((sum, result) => sum + (result.score || 0), 0);
        const lowerScoringSessions = await TestResult.aggregate([
            { $group: { _id: "$sessionId", totalScore: { $sum: "$score" } } },
            { $match: { totalScore: { $lt: totalScore } } },
            { $count: "count" }
        ]);
        const totalSessions = await TestResult.distinct("sessionId").then(sessions => sessions.length);
        const percentile = totalSessions > 0 ? (lowerScoringSessions[0]?.count || 0) / totalSessions * 100 : 100;
        res.json({ percentile: Math.round(percentile) });
    } catch (error) {
        res.status(500).json({ message: 'Error calculating percentile.' });
    }
});

// --- Admin-Only Routes ---
app.get('/api/admin/results', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let results = await TestResult.find({}).sort({ submittedAt: -1 }).populate('user', 'username email');
        results = results.map(r => {
            if (r.testType === 'Excel' && r.filePath) {
                r.filePath = createDownloadUrl(r.filePath);
            }
            return r;
        });
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching results.' });
    }
});

app.post('/api/admin/passages', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { content, difficulty } = req.body;
        if (!content) return res.status(400).json({ message: 'Passage content is required.' });
        const newPassage = new Passage({ content, difficulty });
        await newPassage.save();
        res.status(201).json({ message: 'Passage added successfully!', passage: newPassage });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding passage.' });
    }
});

app.post('/api/admin/letter-questions', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { questionText, category } = req.body;
        if (!questionText) return res.status(400).json({ message: 'Question text is required.' });
        const newQuestion = new LetterQuestion({ questionText, category });
        await newQuestion.save();
        res.status(201).json({ message: 'Letter question added successfully!', question: newQuestion });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding question.' });
    }
});

const adminExcelUpload = uploadLocally.fields([{ name: 'questionFile', maxCount: 1 }, { name: 'solutionFile', maxCount: 1 }]);
app.post('/api/admin/excel-questions', authMiddleware, adminMiddleware, upload.fields([
    { name: 'questionFile', maxCount: 1 },
    { name: 'solutionFile', maxCount: 1 }
]), async (req, res) => {
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
});

// -------------------
//  GLOBAL ERROR HANDLER & SERVER START
// -------------------
app.use((err, req, res, next) => {
  console.error("An error occurred:", err.message);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }
  res.status(500).json({ message: "An internal server error occurred." });
});

app.listen(PORT, () => {
  console.log(`Server is successfully running on http://localhost:${PORT}`);
});