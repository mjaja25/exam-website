// -------------------
//  IMPORTS
// -------------------
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


// -------------------
//  INITIALIZATIONS
// -------------------
const app = express();
const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -------------------
//  MIDDLEWARE
// -------------------
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // For serving files like CSS and the downloadable Excel file

// --- Authentication Middleware ---
const authMiddleware = async (req, res, next) => {
    try {
        // Find the user by the ID that was attached in the authMiddleware
        const user = await User.findById(req.userId);

        // Check if the user exists and their role is 'admin'
        if (user && user.role === 'admin') {
            next(); // User is an admin, proceed to the route
        } else {
            // User is not an admin, send a 'Forbidden' error
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error.' });
    }
};

// --- Admin-Only Middleware ---
const adminMiddleware = async (req, res, next) => {
    try {
        // Find the user by the ID attached from the authMiddleware
        const user = await User.findById(req.userId);

        // Check if the user exists and their role is 'admin'
        if (user && user.role === 'admin') {
            next(); // User is an admin, proceed to the next step
        } else {
            // User is not an admin, send a 'Forbidden' error
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
//  DATABASE SCHEMA & MODEL
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
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['user', 'admin'], // The role can only be 'user' or 'admin'
        default: 'user'         // New users will be 'user' by default
    }
});
const TestResult = mongoose.model('TestResult', testResultSchema);
const User = mongoose.model('User', UserSchema);

// -------------------
//  MULTER CONFIGURATION (for Excel file uploads)
// -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // IMPORTANT: You must create this 'uploads' folder manually
  },
  filename: function (req, file, cb) {
    cb(null, 'submission-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// -------------------
//  API ROUTES
// -------------------

// --- USER DASHBOARD ROUTE ---
app.get('/api/user/dashboard', authMiddleware, async (req, res) => {
    try {
        // req.userId is available thanks to our authMiddleware
        // Find all results where the 'user' field matches the logged-in user's ID
        const results = await TestResult.find({ user: req.userId })
            .sort({ submittedAt: -1 }); // Sort by most recent

        res.json({ results });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

// --- ADMIN ROUTE ---
app.get('/api/admin/results', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Find all test results and sort by most recent
        const results = await TestResult.find({})
            .sort({ submittedAt: -1 }) 
            // This is the magic line: it finds the user associated with the result
            // and populates their 'username' field.
            .populate('user', 'username'); 

        res.json(results);
    } catch (error) {
        console.error("Error fetching admin results:", error);
        res.status(500).json({ message: 'Server error fetching results.' });
    }
});

// --- ROOT ROUTE ---
// Redirect users from the main URL to the login page
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// --- AUTHENTICATION ROUTES ---
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
app.get('/api/auth/verify-token', authMiddleware, (req, res) => {
    // If authMiddleware passes, the token is valid.
    res.status(200).json({ message: 'Token is valid.' });
});

// login
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
        // --- DEBUGGING CODE ---
        console.log("!!!!!!!!!! LOGIN ROUTE CRASHED !!!!!!!!!!");
        console.log("THE FULL ERROR OBJECT IS:", error);
        // --- END DEBUGGING CODE ---
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// Route 1: Typing Test Submission
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

// Route 2: Letter Test Submission (with AI Grading)
app.post('/api/submit/letter', authMiddleware,  async (req, res) => {
    try {
        const letterContent = req.body.content;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
        const gradingPrompt = `
            Please act as a strict examiner. Grade the following formal letter out of 10 based on these criteria:
            1.  **Format (3 marks):** Check for sender's address, date, receiver's address, subject, salutation (e.g., "Dear Sir/Madam,"), and closing (e.g., "Yours sincerely,"). Deduct 1 mark for each missing or incorrect format element.
            2.  **Content (4 marks):** Does the body of the letter clearly and concisely address the question asked? Is the tone appropriate? Start with 4 marks and deduct based on clarity and relevance.
            3.  **Grammar & Spelling (3 marks):** Start with 3 marks. Deduct 1 mark for every 2-3 significant grammatical errors or spelling mistakes. A single mistake might be overlooked.

            Analyze the following letter:
            ---
            ${letterContent}
            ---

            Provide your response ONLY in a valid JSON format, like this:
            {
              "score": <total_score_out_of_10>,
              "feedback": "<brief_feedback_explaining_the_score>"
            }
        `;
        const result = await model.generateContent(gradingPrompt);
        const responseText = await result.response.text();
        const cleanedText = responseText.replace(/```json|```/g, '').trim();
        const grade = JSON.parse(cleanedText);
        
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
        res.status(500).json({ message: 'Failed to grade or save letter.' });
    }
});


// Route 3: Excel Test Submission Route
app.post('/api/submit/excel', authMiddleware, upload.single('excelFile'), async (req, res, next) => {
  // We add 'next' here to pass errors along
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
    next(error); // Pass database errors to our error handler
  }
});

// -------------------
// NEW: GLOBAL ERROR HANDLER
// -------------------
// This middleware MUST be at the end of your file, after all other routes.
// It will catch any errors that occur in your routes.
app.use((err, req, res, next) => {
  console.error("An error occurred:", err.message); // Log the actual error
  if (err instanceof multer.MulterError) {
    // A Multer error occurred (e.g., file too large).
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }
  // For all other errors, send a generic server error message.
  res.status(500).json({ message: "An internal server error occurred." });
});


// -------------------
//  SERVER START
// -------------------
app.listen(PORT, () => {
  console.log(`Server is successfully running on http://localhost:${PORT}`);
});