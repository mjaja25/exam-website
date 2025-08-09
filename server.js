// -------------------
//  IMPORTS
// -------------------
require('dotenv').config();
const User = require('./models/User');
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
require('./passport-setup');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const Passage = require('./models/Passage');
const LetterQuestion = require('./models/LetterQuestion');
const ExcelQuestion = require('./models/ExcelQuestion');
const ExcelJS = require('exceljs');
const fs = require('fs');

// -------------------
//  INITIALIZATIONS
// -------------------
const app = express();
const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -------------------
//  MIDDLEWARE SETUP
// -------------------
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
// Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET, // Add a SESSION_SECRET to your .env file
  resave: false,
  saveUninitialized: true,
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

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
    sessionId: { type: String, index: true },
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



const TestResult = mongoose.model('TestResult', testResultSchema);
// -------------------
//  MULTER CONFIGURATION
// -------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Check which route is being used to determine the save location
    if (req.path.includes('/admin/excel-questions')) {
      cb(null, 'private/excel_files/'); // Admin uploads go to the permanent folder
    } else {
      cb(null, 'uploads/'); // User submissions go to the temporary folder
    }
  },
  filename: function (req, file, cb) {
    // Use a clean, original filename for templates
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// This multer configuration will handle two different file fields
const excelUpload = upload.fields([
    { name: 'questionFile', maxCount: 1 },
    { name: 'solutionFile', maxCount: 1 }
]);

// -------------------
//  API ROUTES
// -------------------

// --- General Routes ---
app.get('/', (req, res) => { res.redirect('/login.html') });

// --- GOOGLE AUTHENTICATION ROUTES ---

// Route 1: The "Login with Google" button will point here
// This route tells Passport to kick off the Google authentication process
app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Route 2: Google will redirect the user back to this URL after they grant permission
// This route is where we handle the user's profile information
app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // On successful authentication, Passport attaches the user to req.user.
    // We can now create our own JWT to send to the frontend.
    const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Instead of directly sending the token, we'll redirect to a special
    // frontend page that can save the token and then go to the dashboard.
    res.redirect(`/auth-success.html?token=${token}`);
  }
);

// --- Auth Routes ---
// Register a new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create a verification token (can be a simple JWT)
        const verificationToken = jwt.sign({ email: email }, process.env.JWT_SECRET, { expiresIn: '1d' });

        const newUser = new User({ 
            username,
            email, 
            password: hashedPassword,
            verificationToken: verificationToken
        });
        await newUser.save();

        // Send the verification email
        const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}`;
        const msg = {
            to: email,
            from: process.env.VERIFIED_SENDER_EMAIL,
            subject: 'Please Verify Your Email Address',
            html: `
                <h2>Welcome to nssbcpt!</h2>
                <p>Thank you for registering. Please click the link below to verify your email address:</p>
                <a href="${verificationUrl}" target="_blank">Verify My Email</a>
            `,
        };
        await sgMail.send(msg);

        res.status(201).json({ message: 'User created successfully! Please check your email to verify your account.' });
    } catch (error) {
        res.status(500).json({ message: 'An error occurred while creating the user.' });
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
        user.verificationToken = undefined; // Clear the token
        await user.save();

        // **NEW:** Create a login token for the now-verified user
        const loginToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // **NEW:** Redirect to the auth-success page to save the token and go to the dashboard
        res.redirect(`/auth-success.html?token=${loginToken}`);

        res.send('<h1>Email successfully verified!</h1><p>You can now <a href="/login.html">log in</a> to your account.</p>');
    } catch (error) {
        res.status(400).send('<h1>Invalid or expired verification link.</h1>');
    }
});

// Login an existing user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body; // Changed from username
        const user = await User.findOne({ email }); // Find by email
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        
        // --- NEW LOGIC ---
        // Check if the user has a password. If not, they signed up with Google.
        if (!user.password) {
            return res.status(400).json({ 
                message: 'You have previously signed in with Google. Please use the "Sign in with Google" button.' 
            });
        }
        // --- END OF NEW LOGIC ---

        // **NEW:** Check if the user's email is verified
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

app.get('/api/auth/verify-token', authMiddleware, (req, res) => {
    res.status(200).json({ message: 'Token is valid.' });
});

// --- User-Specific Routes ---
app.get('/api/user/dashboard', authMiddleware, async (req, res) => {
    try {
        // Find the user making the request
        const user = await User.findById(req.userId);
        // Find the results for that user
        const results = await TestResult.find({ user: req.userId }).sort({ submittedAt: -1 });
        // Send back both the user details and their results
        res.json({ user: { username: user.username }, results });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

//  Random Passage and Typing Test Route
app.get('/api/passages/random', authMiddleware, async (req, res) => {
    try {
        // Get a count of all passages
        const count = await Passage.countDocuments();
        // Generate a random number
        const random = Math.floor(Math.random() * count);
        // Find one random passage
        const passage = await Passage.findOne().skip(random);
        
        if (!passage) {
            return res.status(404).json({ message: 'No passages found.' });
        }
        res.json(passage);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching passage.' });
    }
});

app.post('/api/submit/typing', authMiddleware, async (req, res) => {
    try {
        const { wpm, accuracy, sessionId } = req.body;
        let score = 0; // Default score is 0

        // --- New Scoring Logic ---
        const meetsQualification = wpm >= 35 && accuracy >= 95;

        if (meetsQualification) {
            // 1. Base score for qualifying
            score = 10;

            // 2. Speed bonus (max 5 points)
            const speedBonus = Math.floor((wpm - 35) / 5);
            score += Math.min(speedBonus, 5);

            // 3. Accuracy bonus (max 5 points)
            const accuracyBonus = Math.floor(accuracy - 95);
            score += Math.min(accuracyBonus, 5);
        }
        // If they don't meet qualification, score remains 0.
        // --- End of Scoring Logic ---
        const newResult = new TestResult({
            testType: 'Typing',
            user: req.userId,
            sessionId: req.body.sessionId,
            wpm: req.body.wpm,
            accuracy: req.body.accuracy,
            score: Math.min(score, 20)
        });
        await newResult.save();
        res.status(201).json({ message: 'Result saved successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to save result.' });
    }
});

//  Random Letter Question and AI Grading
app.get('/api/letter-questions/random', authMiddleware, async (req, res) => {
    try {
        const count = await LetterQuestion.countDocuments();
        const random = Math.floor(Math.random() * count);
        const question = await LetterQuestion.findOne().skip(random);
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching question.' });
    }
});

// In server.js
app.post('/api/submit/letter', authMiddleware, async (req, res) => {
    try {
        // We now get both the user's answer and the ID of the question they answered
        const { content, sessionId, questionId } = req.body; 

        // Fetch the original question text from the database
        const originalQuestion = await LetterQuestion.findById(questionId);
        if (!originalQuestion) {
            return res.status(404).json({ message: 'Original question not found.' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const gradingPrompt = `
            Please act as a strict examiner. Your entire response must be ONLY a valid JSON object and nothing else.

            You are grading a formal letter written in response to a specific question. Grade the letter out of 10 based on the following criteria:
            1.  **Content (4 marks):** How well does the letter's body address the specific question asked? Assess clarity, relevance, and tone.
            2.  **Format (3 marks):** Check for sender's address, date, receiver's address, subject, salutation, and closing. Deduct marks for missing elements.
            3.  **Grammar & Spelling (3 marks):** Deduct marks for significant errors.

            If the provided response is not a valid letter or is too short to grade, return a score of 0 with appropriate feedback.

            ---
            CONTEXT
            Question Asked: "${originalQuestion.questionText}"
            User's Letter: "${content}"
            ---

            Return your analysis ONLY in this exact JSON format:
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
            sessionId: req.body.sessionId,
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

//  Random Excel File and Submit Excel 
app.get('/api/excel-questions/random', authMiddleware, async (req, res) => {
    try {
        const count = await ExcelQuestion.countDocuments();
        const random = Math.floor(Math.random() * count);
        const question = await ExcelQuestion.findOne().skip(random);
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching question.' });
    }
});

app.post('/api/submit/excel', authMiddleware, upload.single('excelFile'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const { sessionId, questionId } = req.body;
        
        // 1. Find the original question and its solution path from the database
        const originalQuestion = await ExcelQuestion.findById(questionId);
        if (!originalQuestion) {
            return res.status(404).json({ message: 'Excel question not found.' });
        }

        // 2. Read the correct solution workbook and convert its data to JSON
        // Read the solution file
        const solutionWorkbook = new ExcelJS.Workbook();
        await solutionWorkbook.xlsx.readFile(originalQuestion.solutionFilePath);
        const solutionSheet1Data = JSON.stringify(solutionWorkbook.getWorksheet(1).getSheetValues());
        const solutionSheet2Instructions = JSON.stringify(solutionWorkbook.getWorksheet(2).getSheetValues());

        // 3. Read the user's submitted workbook and convert its data to JSON
        const userWorkbook = new ExcelJS.Workbook();
        await userWorkbook.xlsx.readFile(req.file.path);
        const userSheet1Data = JSON.stringify(userWorkbook.getWorksheet(1).getSheetValues());
        
        // 4. Create the AI Grading Prompt
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const gradingPrompt = `
            Act as an expert Excel test grader. Your response must be ONLY a valid JSON object.
            The user was given an Excel test with two worksheets.
            - The first worksheet is the exercise.
            - The second worksheet contains a list of 5 instructions.

            You must grade the user's work on the first worksheet based *only* on the 5 instructions provided. Each instruction is worth 4 marks, for a total of 20 marks.

            ---
            GRADING RUBRIC (Instructions from the 2nd worksheet of the solution file):
            ${solutionSheet2Instructions}
            ---
            CORRECT SOLUTION DATA (From the 1st worksheet of the solution file):
            ${solutionSheet1Data}
            ---
            USER SUBMISSION DATA (From the 1st worksheet of the user's file):
            ${userSheet1Data}
            ---

            Analyze the user's submission against the correct solution, following the instructions in the rubric. Award 4 marks for each correctly completed instruction. Provide a final score out of 20.

            Return your analysis ONLY in this exact JSON format:
            {
            "score": <total_score_out_of_20>,
            "feedback": "<Detailed, point-by-point feedback explaining how many marks were awarded for each of the 5 instructions.>"
            }
        `;
        
        // 5. Get and parse the AI's grade
        const result = await model.generateContent(gradingPrompt);
        const responseText = await result.response.text();
        
        let grade;
        try {
            const cleanedText = responseText.replace(/```json|```/g, '').trim();
            grade = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("AI returned non-JSON response for Excel grading:", responseText);
            grade = { score: 0, feedback: "Automated grading failed due to an unexpected format from the AI." };
        }
        
        // 6. Save the final result to the database
        const newResult = new TestResult({
            testType: 'Excel',
            user: req.userId,
            sessionId: sessionId,
            filePath: req.file.path,
            score: grade.score,
            feedback: grade.feedback // You can save the feedback for review
        });
        await newResult.save();
        
        // 7. Send success response to the frontend
        res.status(201).json({ message: 'Excel file graded and submitted successfully!', grade: grade });

    } catch (error) {
        next(error); // Pass any other errors to the global error handler
    }
});

// --- Route to fetch results for a specific session ---
app.get('/api/results/percentile/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Find the total score for the user's current session
        const userResults = await TestResult.find({ sessionId });
        const totalScore = userResults.reduce((sum, result) => sum + (result.score || 0), 0);
        
        // Count how many other sessions had a lower total score
        const lowerScoringSessions = await TestResult.aggregate([
            { $group: { _id: "$sessionId", totalScore: { $sum: "$score" } } },
            { $match: { totalScore: { $lt: totalScore } } },
            { $count: "count" }
        ]);

        // Count all unique sessions
        const totalSessions = await TestResult.distinct("sessionId").countDocuments();

        const percentile = totalSessions > 0 
            ? (lowerScoringSessions[0]?.count || 0) / totalSessions * 100 
            : 100;

        res.json({ percentile: Math.round(percentile) });
    } catch (error) {
        res.status(500).json({ message: 'Error calculating percentile.' });
    }
});
app.get('/api/results/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const results = await TestResult.find({ 
            user: req.userId, 
            sessionId: sessionId 
        });

        if (!results) {
            return res.status(404).json({ message: 'Results not found for this session.' });
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching results.' });
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
app.post('/api/admin/passages', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { content, difficulty } = req.body;
        if (!content) {
            return res.status(400).json({ message: 'Passage content is required.' });
        }
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
        const newQuestion = new LetterQuestion({ questionText, category });
        await newQuestion.save();
        res.status(201).json({ message: 'Letter question added successfully!', question: newQuestion });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding question.' });
    }
});

app.post('/api/admin/excel-questions', authMiddleware, adminMiddleware, excelUpload, async (req, res) => {
    try {
        const { questionName } = req.body;
        // req.files will contain the uploaded file objects
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