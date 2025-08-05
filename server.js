// -------------------
//  IMPORTS
// -------------------
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const path = require('path');

// -------------------
//  INITIALIZATIONS
// -------------------
const app = express();
const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -------------------
//  MIDDLEWARE SETUP
// -------------------
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Authentication Middleware ---
// This function verifies the JWT token for any logged-in user.
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1]; // "Bearer TOKEN"
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decodedToken.userId; // Attach user ID to the request object
        next();
    } catch (error) {
        res.status(401).json({ message: 'Authentication failed. Please log in.' });
    }
};

// --- Admin-Only Middleware ---
// This function checks if the logged-in user (verified by authMiddleware first) has the 'admin' role.
const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (user && user.role === 'admin') {
            next(); // User is an admin, proceed
        } else {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error.' });
    }
};

// -------------------
//  DATABASE CONNECTION
// -------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// -------------------
//  DATABASE SCHEMAS & MODELS
// -------------------
const testResultSchema = new mongoose.Schema({
    testType: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    wpm: { type: Number },
    accuracy: { type: Number },
    content: { type: String },
    filePath: { type: String },
    score: { type: Number },
    feedback: { type: String },
    submittedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

const TestResult = mongoose.model('TestResult', testResultSchema);
const User = mongoose.model('User', userSchema);

// -------------------
//  MULTER CONFIGURATION
// -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/') },
  filename: (req, file, cb) => { cb(null, 'submission-' + Date.now() + path.extname(file.originalname)) }
});
const upload = multer({ storage: storage });

// -------------------
//  API ROUTES
// -------------------

// --- General Routes ---
app.get('/', (req, res) => { res.redirect('/login.html') });

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully!' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Username is already taken.' });
        }
        res.status(500).json({ message: 'An error occurred while creating the user.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
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

app.get('/api/auth/verify-token', authMiddleware, (req, res) => {
    res.status(200).json({ message: 'Token is valid.' });
});

// --- User-Specific Routes ---
app.get('/api/user/dashboard', authMiddleware, async (req, res) => {
    try {
        const results = await TestResult.find({ user: req.userId }).sort({ submittedAt: -1 });
        res.json({ results });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

app.post('/api/submit/typing', authMiddleware, async (req, res) => {
    try {
        const newResult = new TestResult({
            testType: 'Typing',
            user: req.userId,
            wpm: req.body.wpm,
            accuracy: req.body.accuracy
        });
        await newResult.save();
        res.status(201).json({ message: 'Result saved successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to save result.' });
    }
});

// In server.js
// In server.js
app.post('/api/submit/letter', authMiddleware, async (req, res) => {
    try {
        const letterContent = req.body.content;

        // --- Improved AI Grading Logic ---
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const gradingPrompt = `
            Please act as a strict examiner. Your response must be ONLY a valid JSON object.
            Grade the following formal letter out of 10 based on these criteria:
            1.  Format (3 marks): Check for sender's address, date, receiver's address, subject, salutation, and closing. Deduct marks for missing elements.
            2.  Content (4 marks): Assess clarity, relevance, and tone.
            3.  Grammar & Spelling (3 marks): Deduct for significant errors.

            If the text below is not a valid letter or is too short to grade, return a score of 0 with appropriate feedback.

            Analyze this text:
            ---
            ${letterContent}
            ---

            Return your response ONLY in this exact JSON format:
            {
              "score": <total_score_out_of_10>,
              "feedback": "<brief_feedback_explaining_the_score>"
            }
        `;

        const result = await model.generateContent(gradingPrompt);
        const responseText = await result.response.text();
        
        let grade;
        // Safety check to ensure the response is valid JSON
        try {
            const cleanedText = responseText.replace(/```json|```/g, '').trim();
            grade = JSON.parse(cleanedText);
        } catch (parseError) {
            // If AI response is not JSON, create a default error response
            console.error("AI returned non-JSON response:", responseText);
            grade = { score: 0, feedback: "Could not grade the submission due to an invalid format." };
        }
        
        const newResult = new TestResult({
            testType: 'Letter',
            user: req.userId,
            content: letterContent,
            score: grade.score,
            feedback: grade.feedback
        });

        await newResult.save();
        res.status(201).json({ message: 'Letter graded and saved successfully!', grade: grade });

    } catch (error) {
        console.error("!!! LETTER GRADING FAILED !!!", error);
        res.status(500).json({ message: 'Failed to grade or save letter.' });
    }
});

app.post('/api/submit/excel', authMiddleware, upload.single('excelFile'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        const newResult = new TestResult({
            testType: 'Excel',
            user: req.userId,
            filePath: req.file.path
        });
        await newResult.save();
        res.status(201).json({ message: 'Excel file uploaded successfully!' });
    } catch (error) {
        next(error);
    }
});

// --- Admin-Only Routes ---
app.get('/api/admin/results', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const results = await TestResult.find({}).sort({ submittedAt: -1 }).populate('user', 'username');
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching results.' });
    }
});

// -------------------
//  GLOBAL ERROR HANDLER
// -------------------
app.use((err, req, res, next) => {
  console.error("An error occurred:", err.message);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }
  res.status(500).json({ message: "An internal server error occurred." });
});

// -------------------
//  SERVER START
// -------------------
app.listen(PORT, () => {
  console.log(`Server is successfully running on http://localhost:${PORT}`);
});