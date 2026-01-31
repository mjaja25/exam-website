// -------------------
//  IMPORTS
// -------------------
require('dotenv').config();
require('./passport-setup');
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
const csv = require('csv-parser');

// --- MODEL IMPORTS ---
const User = require('./models/User');
const TestResult = require('./models/TestResult');
const Passage = require('./models/Passage');
const LetterQuestion = require('./models/LetterQuestion');
const ExcelQuestion = require('./models/ExcelQuestion');
const Feedback = require('./models/Feedback');
const MCQSet = require('./models/MCQSet');
const MCQQuestion = require('./models/MCQQuestion');
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
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
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
    const token = jwt.sign({ userId: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
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
        res.json({ user: user, results: results });

    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

app.get('/api/passages/random', authMiddleware, async (req, res) => {
    try {
        const requestedDiff = req.query.difficulty; // Gets 'easy', 'medium', or 'hard' from URL
        
        // 1. Build the filter object
        let filter = {};
        if (requestedDiff && ['easy', 'medium', 'hard'].includes(requestedDiff)) {
            filter.difficulty = requestedDiff;
        } else {
            // Default for official exams where no difficulty is specified in the URL
            filter.difficulty = 'medium'; 
        }

        // 2. Count how many passages match this difficulty
        const count = await Passage.countDocuments(filter);
        
        if (count === 0) {
            // Robustness: fallback if an admin hasn't uploaded passages for a specific level yet
            return res.status(404).json({ message: `No passages found for difficulty: ${filter.difficulty}` });
        }

        // 3. Get one random passage from the filtered list
        const randomIndex = Math.floor(Math.random() * count);
        const passage = await Passage.findOne(filter).skip(randomIndex);

        res.json(passage);
    } catch (error) {
        console.error("FETCH PASSAGE ERROR:", error);
        res.status(500).json({ message: "Server error fetching passage." });
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
        const { wpm, accuracy, sessionId, testPattern } = req.body;
        const userId = req.userId;

        // Calculate marks: New Pattern = 30 max, Standard = 20 max
        let typingScore = 0;
        if (testPattern === 'new_pattern') {
            typingScore = Math.min(30, (wpm / 35) * 30);
        } else {
            typingScore = Math.min(20, (wpm / 35) * 20);
        }

        // Create or Update the TestResult
        const result = await TestResult.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            { 
                wpm, 
                accuracy, 
                typingScore: typingScore.toFixed(2),
                testPattern,
                status: 'in-progress' // Still waiting for MCQ or Letter
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, typingScore: typingScore });
    } catch (error) {
        res.status(500).json({ message: "Error saving typing results." });
    }
});

app.post('/api/submit/letter', authMiddleware, async (req, res) => {
    console.log("--- Letter Submission Started ---");
    console.log("SessionID:", req.body.sessionId);
    console.log("UserID from Auth:", req.userId);

    try {
        const { content, sessionId, questionId } = req.body;
        const userId = req.userId;

        if (!sessionId || !userId) {
            return res.status(400).json({ message: "Missing SessionID or UserID" });
        }

        const originalQuestion = await LetterQuestion.findById(questionId);
        if (!originalQuestion) return res.status(404).json({ message: 'Question not found.' });

        // AI GRADING SECTION
        console.log("Contacting Gemini AI...");
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use 1.5-flash for reliability
        
        const gradingPrompt = `Act as a strict examiner... (your prompt) ... HTML Content: "${content}"`;
        const aiResult = await model.generateContent(gradingPrompt);
        const responseText = await aiResult.response.text();
        
        let grade;
        try {
            const cleanedText = responseText.replace(/```json|```/g, '').trim();
            grade = JSON.parse(cleanedText);
        } catch (e) {
            console.error("AI JSON Parse Error:", responseText);
            grade = { score: 0, feedback: "Grading format error." };
        }

        // DATABASE UPDATE SECTION
        console.log("Updating Database...");
        const updatedResult = await TestResult.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            { 
                $set: {
                    letterScore: Number(grade.score) || 0,
                    letterContent: content,
                    letterFeedback: grade.feedback,
                    status: 'in-progress'
                }
            },
            { new: true }
        );

        if (!updatedResult) {
            console.error("FAILED: No session found with ID:", sessionId);
            return res.status(404).json({ message: "Session not found in DB." });
        }

        console.log("✅ Success! Score saved:", grade.score);
        res.status(200).json({ message: 'Letter graded!', grade });

    } catch (error) {
        console.error("CRITICAL SERVER ERROR:", error); // This will show up in Render logs
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/submit/excel', authMiddleware, uploadToCloudinary.single('excelFile'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        const { sessionId, questionId } = req.body;
        const userId = req.userId;
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

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
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
        // --- UNIFIED UPDATE & COMPLETION ---
        const existingRecord = await TestResult.findOne({ sessionId, user: userId });
        
        const typingMarks = parseFloat(existingRecord.typingScore) || 0;
        const letterMarks = parseFloat(existingRecord.letterScore) || 0;
        const excelMarks = grade.score;
        
        const finalTotal = typingMarks + letterMarks + excelMarks;

        await TestResult.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            { 
                excelScore: excelMarks,
                excelFeedback: grade.feedback,
                totalScore: finalTotal.toFixed(2),
                status: 'completed' // Mark as finished
            }
        );

        res.status(200).json({ message: 'Test Completed!', total: finalTotal });
    } catch (error) {
        next(error);
    }
});

app.get('/api/results/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        // Find the single document for this session
        const sessionResult = await TestResult.findOne({ 
            sessionId: sessionId, 
            user: userId 
        });

        if (!sessionResult) {
            return res.status(404).json({ message: 'No results found for this session.' });
        }

        /**
         * TRANSFORM FOR FRONTEND COMPATIBILITY
         * Your results.js expects an array with 'testType' identifiers.
         * We map our unified document fields back into that format.
         */
        const legacyFormat = [
            {
                testType: 'Typing',
                score: Number(sessionResult.typingScore) || 0,
                wpm: sessionResult.wpm || 0,
                accuracy: sessionResult.accuracy || 0
            },
            {
                testType: 'Letter',
                score: Number(sessionResult.letterScore) || 0,
                feedback: sessionResult.letterFeedback || 'N/A'
            },
            {
                testType: 'Excel',
                score: Number(sessionResult.excelScore || sessionResult.mcqScore) || 0,
                feedback: sessionResult.excelFeedback || 'N/A'
            }
        ];

        res.json(legacyFormat);
    } catch (error) {
        console.error("Fetch Results Error:", error);
        res.status(500).json({ message: 'Server error fetching unified results.' });
    }
});

app.get('/api/results/percentile/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;

        // 1. Get the current user's total score for this session
        const currentSession = await TestResult.findOne({ sessionId });
        if (!currentSession || !currentSession.totalScore) {
            return res.json({ percentile: 0 });
        }

        const userScore = parseFloat(currentSession.totalScore);

        // 2. Count how many OTHER completed sessions have a lower totalScore
        const lowerScoringCount = await TestResult.countDocuments({
            status: 'completed',
            totalScore: { $lt: userScore }
        });

        // 3. Count total number of completed exam sessions
        const totalSessions = await TestResult.countDocuments({ status: 'completed' });

        // 4. Calculate percentile: (Number of people below you / Total people) * 100
        const percentile = totalSessions > 1 
            ? (lowerScoringCount / (totalSessions - 1)) * 100 
            : 100; // If you're the only one, you're the 100th percentile

        res.json({ percentile: Math.round(percentile) });
    } catch (error) {
        console.error("Percentile Calculation Error:", error);
        res.status(500).json({ message: 'Error calculating percentile.' });
    }
});

// --- Route to get aggregate test statistics ---
app.get('/api/stats/all-tests', authMiddleware, async (req, res) => {
    try {
        const stats = await TestResult.aggregate([
            {
                $group: {
                    _id: "$testType", // Group by Typing, Letter, Excel
                    averageScore: { $avg: "$score" },
                    topScore: { $max: "$score" }
                }
            }
        ]);

        // The aggregation returns an array, let's format it into a simple object
        const formattedStats = stats.reduce((acc, item) => {
            acc[item._id] = {
                average: item.averageScore,
                top: item.topScore
            };
            return acc;
        }, {});

        res.json(formattedStats);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching stats.' });
    }
});
// LEADERBOARD
app.get('/api/leaderboard', async (req, res) => {
    try {
        const requestedPattern = req.query.pattern || 'standard'; // Default to standard

        const topScores = await TestResult.find({ 
            testPattern: requestedPattern,
            attemptMode: 'exam', // Robustness: Ignore practice sessions
            status: 'completed'   // Only show finished exams
        })
        .sort({ totalScore: -1 }) // Sort by highest total marks
        .limit(10)
        .populate('user', 'username'); // Get names from the User collection

        res.json(topScores);
    } catch (error) {
        console.error("LEADERBOARD ERROR:", error);
        res.status(500).json({ message: "Error fetching rankings." });
    }
});

let leaderboardCache = null;
let lastCacheTime = 0;

app.get('/api/leaderboard/all', async (req, res) => {
    const now = Date.now();
    // 1. Serve from cache if fresh (within 60 seconds)
    if (leaderboardCache && (now - lastCacheTime < 60000)) {
        return res.json(leaderboardCache);
    }

    try {
        // 1. Standard Pattern - Overall (Typing + Letter + Practical)
        const std_overall = await TestResult.find({
            testPattern: 'standard',
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ totalScore: -1 }).limit(10).populate('user', 'username');

        // 2. Standard Pattern - Pure Typing Speed
        const std_typing = await TestResult.find({
            testPattern: 'standard',
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ wpm: -1 }).limit(10).populate('user', 'username');

        // 3. Standard Pattern - Letter
        const std_letter = await TestResult.find({
            testPattern: 'standard',
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ score: -1 }).limit(10).populate('user', 'username');

        // 4. Standard Pattern - Excel
        const std_excel = await TestResult.find({
            testPattern: 'standard',
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ score: -1 }).limit(10).populate('user', 'username');

        // 5. New Pattern - Overall
        const new_overall = await TestResult.find({
            testPattern: 'new_pattern',
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ totalScore: -1 }).limit(10).populate('user', 'username');

        // 6. New Pattern - Typing (10 mins)
        const new_typing = await TestResult.find({
            testPattern: 'new_pattern',
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ score: -1, wpm: -1, accuracy: -1}).limit(10).populate('user', 'username');

        // 7. New Pattern - Excel MCQ
        const new_mcq = await TestResult.find({
            testPattern: 'new_pattern',
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ mcqScore: -1 }).limit(10).populate('user', 'username');

        const results = {
            std_overall, 
            std_typing, 
            std_letter,
            std_excel,
            new_overall, 
            new_typing,
            new_mcq};
        leaderboardCache=results;
        lastCacheTime=now;
        res.json(results);

    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        res.status(500).json({ message: "Failed to load rankings." });
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

// --- NEW: Bulk MCQ Upload Route ---
const csvUpload = multer({ dest: 'temp_csv/' });
app.post('/api/admin/bulk-mcqs', authMiddleware, adminMiddleware, csvUpload.single('csvFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded." });
    }

    const results = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
            // Transform CSV row into our Database Model format
            results.push({
                questionText: data.questionText,
                options: [data.optionA, data.optionB, data.optionC, data.optionD],
                correctAnswerIndex: parseInt(data.correctAnswerIndex),
                category: data.category
            });
        })
        .on('end', async () => {
            try {
                if (results.length === 0) {
                    fs.unlinkSync(filePath);
                    return res.status(400).json({ message: "CSV file is empty or formatted incorrectly." });
                }

                // Bulk insert into MongoDB
                const docs = await MCQQuestion.insertMany(results);
                
                // Delete the temporary file to keep your server clean
                fs.unlinkSync(filePath); 
                
                res.json({ message: "Upload successful", count: docs.length });
            } catch (err) {
                // If DB fails, still delete the temp file
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                res.status(500).json({ message: "Database Error during bulk insert", error: err.message });
            }
        })
        .on('error', (err) => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            res.status(500).json({ message: "Error parsing CSV file", error: err.message });
        });
});


// FEEDBACK ROUTE ---

app.post('/api/feedback', authMiddleware, async (req, res) => {
    try {
        const { feedbackType, message } = req.body;
        const newFeedback = new Feedback({
            user: req.userId,
            feedbackType,
            message
        });
        await newFeedback.save();
        res.status(201).json({ message: 'Feedback submitted successfully. Thank you!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

//  END OF FEEDBACK ===



// Centralized Error Middleware
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack);
    
    // Check if the error is from Cloudinary/Multer
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Max limit is 5MB.' });
    }

    res.status(err.status || 500).json({
        message: err.message || 'An internal server error occurred.',
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
});

app.listen(PORT, () => {
  console.log(`Server is successfully running on http://localhost:${PORT}`);
});

//  Check if api key is getting recognised

app.get('/api/debug-key', (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({
        exists: !!key,
        length: key ? key.length : 0,
        // Shows the first 4 characters to confirm it's the NEW key
        prefix: key ? key.substring(0, 4) : "none"
    });
});

//  MCQ non repeat api

app.get('/api/exam/get-next-set', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        // Find a set the user hasn't done yet
        const nextSet = await MCQSet.findOne({ 
            _id: { $nin: user.completedMCQSets },
            isActive: true 
        }).populate('questions');

        if (!nextSet) {
            return res.status(404).json({ message: "All available mock sets completed!" });
        }

        res.json({
            setId: nextSet._id,
            setName: nextSet.setName,
            questions: nextSet.questions
        });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching exam set." });
    }
});

// mcq submission route

app.post('/api/submit/excel-mcq', authMiddleware, async (req, res) => {
    try {
        const { sessionId, setId, answers } = req.body;
        const userId = req.userId;

        // 1. Fetch curated set and calculate correct answers
        const examSet = await MCQSet.findById(setId).populate('questions');
        if (!examSet) return res.status(404).json({ message: "Set not found." });

        let correctCount = 0;
        examSet.questions.forEach((q) => {
            if (answers[q._id] === q.correctAnswerIndex) {
                correctCount++;
            }
        });

        // 2. Score Calculation: 10 questions * 2 marks = 20 Marks
        const mcqMarks = correctCount * 2;

        // 3. Fetch previous typing marks to get the total (30 + 20 = 50)
        const typingResult = await TestResult.findOne({ sessionId, user: userId });
        const finalTotal = (parseFloat(typingResult.typingScore) || 0) + mcqMarks;

        // 4. Update Result and User Progress
        const finalResult = await TestResult.findOneAndUpdate(
            { sessionId, user: userId },
            { 
                mcqScore: mcqMarks,
                totalScore: finalTotal.toFixed(2),
                status: 'completed'
            },
            { new: true }
        );

        // Mark set as seen so it doesn't repeat
        await User.findByIdAndUpdate(userId, { $addToSet: { completedMCQSets: setId } });

        res.json({ success: true, score: mcqMarks, total: finalTotal });
    } catch (error) {
        res.status(500).json({ message: "Error saving MCQ results." });
    }
});

app.get('/api/mcqs/practice/:category', authMiddleware, async (req, res) => {
    try {
        const { category } = req.params;
        // Fetch 10 random questions from that specific category
        const questions = await MCQQuestion.aggregate([
            { $match: { category: category } },
            { $sample: { size: 10 } }
        ]);
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: "Error loading practice questions" });
    }
});

// Add this route to server.js
app.get('/api/admin/debug-gemini', authMiddleware, adminMiddleware, async (req, res) => {
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
});