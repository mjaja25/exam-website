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
const PracticeResult = require('./models/PracticeResult');
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
// passport-setup is already required at top of file (line 5)

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

// --- Forgot / Reset Password Routes ---
app.post('/api/auth/forgot-password', async (req, res) => {
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
});

app.post('/api/auth/reset-password', async (req, res) => {
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
});

// --- User-Specific Routes ---
app.get('/api/user/dashboard', authMiddleware, async (req, res) => {
    try {
        // Find the user making the request
        const user = await User.findById(req.userId);

        // Find the results for that user
        let results = await TestResult.find({ user: req.userId }).sort({ submittedAt: -1 });

        // Modify the excelFilePath for any Excel results before sending
        results = results.map(r => {
            if (r.excelFilePath) {
                r.excelFilePath = createDownloadUrl(r.excelFilePath);
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
        let question = await ExcelQuestion.findOne().skip(random).lean(); // Use lean() to modify object

        if (!question) {
            return res.status(404).json({ message: 'No excel questions found.' });
        }

        // Force download for these files
        if (question.questionFilePath) question.questionFilePath = createDownloadUrl(question.questionFilePath);
        if (question.solutionFilePath) question.solutionFilePath = createDownloadUrl(question.solutionFilePath);

        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching question.' });
    }
});
app.post('/api/submit/typing', authMiddleware, async (req, res) => {
    try {
        const { wpm, accuracy, sessionId, testPattern, typingDuration, totalChars, correctChars, errorCount, typingErrorDetails } = req.body;
        const userId = req.userId;

        // Calculate marks: New Pattern = 30 max, Standard = 20 max
        let typingScore = 0;
        if (testPattern === 'new_pattern') {
            typingScore = Math.min(30, Math.round((wpm / 35) * 30));
        } else {
            typingScore = Math.min(20, Math.round((wpm / 35) * 20));
        }

        // Create or Update the TestResult
        const result = await TestResult.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            {
                wpm,
                accuracy,
                typingScore,
                testPattern,
                // Save detailed metrics for AI Analysis
                typingDuration,
                totalChars,
                correctChars,
                errorCount,
                typingErrorDetails,
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
    try {
        const { content, sessionId, questionId } = req.body;
        const userId = req.userId;

        const originalQuestion = await LetterQuestion.findById(questionId);
        if (!originalQuestion) {
            return res.status(404).json({ message: "Letter question not found" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        /* ---------- DETERMINISTIC FORMAT CHECKS ---------- */
        const hasTimesNewRoman =
            /face=["']?Times New Roman["']?/i.test(content) ||
            /font-family\s*:\s*['"]?Times New Roman/i.test(content);

        const hasCorrectFontSize =
            /size=["']?4["']?/.test(content) ||
            /font-size\s*:\s*12pt/i.test(content);

        const subjectUnderlined = /<u>[^<]*Subject:[^<]*<\/u>/i.test(content) || /<u>\s*<[^>]+>[^<]*Subject:/i.test(content);
        const subjectBold = /<b>[^<]*Subject:[^<]*<\/b>/i.test(content) || /<strong>[^<]*Subject:[^<]*<\/strong>/i.test(content) || /<b>\s*<[^>]+>[^<]*Subject:/i.test(content) || /<strong>\s*<[^>]+>[^<]*Subject:/i.test(content);

        let typographyScore = 0;
        if (hasTimesNewRoman) typographyScore += 1;
        if (hasCorrectFontSize) typographyScore += 1;

        let subjectScore = 0;
        if (subjectUnderlined) subjectScore += 1;
        if (subjectBold) subjectScore += 1;

        /* ---------- NORMALIZE EDITOR INDENTATION FOR AI ---------- */
        const normalizedContent = content.replace(
            /<span\s+class=["']editor-indent["'][^>]*>\s*<\/span>/gi,
            '    '
        );

        /* ---------- AI PROMPT (6-Mark Rubric) ---------- */
        const gradingPrompt = `
        You are a formal letter examiner. 
        Below is the letter content you must grade:
        ---
        ${normalizedContent}
        ---
        Formatting facts (already verified by system):
        - Font: ${hasTimesNewRoman ? 'Times New Roman detected' : 'Not detected'}
        - Font Size: ${hasCorrectFontSize ? '12pt detected' : 'Not detected'}
        - Subject Underlined: ${subjectUnderlined}
        - Subject Bold: ${subjectBold}

        Grade ONLY these categories (Total 6 Marks):
        1. Content relevance (3 marks): Does it address "${originalQuestion.questionText}"?
        2. Traditional layout (2 marks): Check paragraphing and spacing.
        3. Presentation (1 mark): General formal appearance.

        Return ONLY JSON:
        {
          "content": { "score": integer, "explanation": "string" },
          "format": { "score": integer, "explanation": "string" },
          "presentation": { "score": integer, "explanation": "string" }
        }

        Note: Explanations must be brief (1 sentence). Use whole numbers for scores.
        `;

        const aiResult = await model.generateContent(gradingPrompt);
        const responseText = aiResult.response.text();

        let aiGrade;
        try {
            const cleanJson = responseText.replace(/```json|```/g, '').trim();
            aiGrade = JSON.parse(cleanJson);
        } catch (err) {
            console.error("AI JSON Parse Error:", responseText);
            return res.status(500).json({ message: "AI evaluation failed" });
        }

        /* ---------- FINAL INTEGER CALCULATIONS (Total 10) ---------- */
        const scores = {
            content: Math.round(aiGrade.content.score || 0),
            format: Math.round(aiGrade.format.score || 0),
            presentation: Math.round(aiGrade.presentation.score || 0),
            typography: Math.round(typographyScore || 0),
            subject: Math.round(subjectScore || 0)
        };

        const totalScore = scores.content + scores.format + scores.presentation + scores.typography + scores.subject;

        // Generate explanations for system checks
        const typographyExplanation = typographyScore === 2
            ? "Correct font (Times New Roman) and size (12pt) used."
            : "Issues detected with font family or size settings.";

        const subjectExplanation = subjectScore === 2
            ? "Subject line is correctly bolded and underlined."
            : "Subject line missing required bold or underline formatting.";

        /* ---------- CONSTRUCT STRUCTURED FEEDBACK ---------- */
        const feedback = [
            `Content: ${scores.content}/3 - ${aiGrade.content.explanation}`,
            `Layout: ${scores.format}/2 - ${aiGrade.format.explanation}`,
            `Presentation: ${scores.presentation}/1 - ${aiGrade.presentation.explanation}`,
            `Typography: ${scores.typography}/2 - ${typographyExplanation}`,
            `Subject Emphasis: ${scores.subject}/2 - ${subjectExplanation}`
        ].join('\n');

        /* ---------- DB UPDATE ---------- */
        const updatedDoc = await TestResult.findOneAndUpdate(
            { sessionId, user: userId },
            {
                $set: {
                    letterScore: Math.min(10, totalScore),
                    letterContent: content,
                    letterFeedback: feedback
                }
            },
            { new: true }
        );

        if (!updatedDoc) return res.status(404).json({ message: "Session not found" });

        res.json({
            success: true,
            grade: {
                score: Math.min(10, totalScore),
                feedback
            }
        });

    } catch (error) {
        console.error("Letter Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
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
        const solutionSheet1 = solutionWorkbook.getWorksheet(1);
        const solutionSheet2 = solutionWorkbook.getWorksheet(2);
        if (!solutionSheet1 || !solutionSheet2) {
            return res.status(400).json({ message: 'Solution file is missing required worksheets (Sheet1 for data, Sheet2 for instructions).' });
        }
        const solutionSheet1Data = JSON.stringify(solutionSheet1.getSheetValues());
        const solutionSheet2Instructions = JSON.stringify(solutionSheet2.getSheetValues());

        const userWorkbook = new ExcelJS.Workbook();
        await userWorkbook.xlsx.load(userFileBuffer);
        const userSheet1Data = JSON.stringify(userWorkbook.getWorksheet(1).getSheetValues());

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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

            Return ONLY a JSON object in this exact format:
            { 
            "score": <number_out_of_20>, 
            "feedback": "<string_point-by-point_feedback>" 
            }

            Note: You MUST provide the feedback as a single string where each observation starts with a number (1., 2., etc.) and is separated by a newline (\\n).
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
                excelFilePath: req.file.path, // Save the path so we can analyze it later!
                excelFeedback: grade.feedback,
                totalScore: finalTotal,
                status: 'completed' // Mark as finished
            }
        );

        res.status(200).json({ message: 'Test Completed!', total: finalTotal });
    } catch (error) {
        next(error);
    }
});

// --- NEW: Detailed Analysis for Official Exam ---
app.post('/api/exam/analyze', authMiddleware, async (req, res) => {
    try {
        const { sessionId, type } = req.body;
        const userId = req.userId;

        // Fetch result (security check included: must belong to user)
        const result = await TestResult.findOne({ sessionId, user: userId });
        if (!result) return res.status(404).json({ message: "Exam session not found." });

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        let analysisPrompt = "";

        // 1. TYPING ANALYSIS
        if (type === 'typing') {
            const { wpm, accuracy, totalChars, correctChars, errorCount, typingDuration, typingErrorDetails } = result;
            analysisPrompt = `
                You are a typing coach. Analyze this exam performance:
                - Speed: ${wpm} WPM (Target: 35+)
                - Accuracy: ${accuracy}%
                - Duration: ${typingDuration ? typingDuration + 's' : 'Standard Exam'}
                - Errors: ${errorCount || 'N/A'}
                ${typingErrorDetails ? `- Patterns: ${typingErrorDetails}` : ''}

                Return ONLY a valid JSON object:
                {
                  "strengths": [{ "title": "string", "detail": "string" }],
                  "improvements": [{ "title": "string", "detail": "string", "suggestion": "string" }],
                  "tips": [{ "text": "string" }]
                }
                Provide 2-3 items per array. Be encouraging but strict on standard.
            `;
        }
        // 2. LETTER ANALYSIS
        else if (type === 'letter') {
            if (!result.letterContent) return res.status(400).json({ message: "No letter content found." });
            analysisPrompt = `
                You are a formal letter tutor. Analyze this exam submission:
                
                Student's Letter:
                ---
                ${result.letterContent}
                ---

                Previous Grading Feedback:
                ${result.letterFeedback || "N/A"}

                Return ONLY a valid JSON object:
                {
                  "strengths": [{ "title": "string", "detail": "string" }],
                  "improvements": [{ "title": "string", "detail": "string", "suggestion": "string" }],
                  "tips": [{ "text": "string" }],
                  "sampleStructure": "Brief text outline of a perfect version of this letter"
                }
            `;
        }
        // 3. EXCEL ANALYSIS
        else if (type === 'excel') {
            // For Excel, ideally we re-read the file, but for speed/simplicity let's base it on the grading feedback 
            // plus general advice, unless we want to download the file again. 
            // Given the complexity of re-downloading and parsing 2 files again, we will enhance the existing feedback.
            // If we really want deep analysis, we'd need to re-implement the parsing logic here.
            // Let's use the stored feedback for now to generate "Next Steps".

            analysisPrompt = `
                You are an Excel tutor. A student just took an exam.
                Their Score: ${result.excelScore}/20.
                
                Automated Grading Feedback received:
                ${result.excelFeedback || "No detailed feedback available."}

                Based on this feedback, provide a structured improvement plan.
                Return ONLY a valid JSON object:
                {
                  "strengths": [{ "title": "Likely Strength", "detail": "Based on score/feedback" }],
                  "improvements": [{ "title": "Area to Fix", "detail": "What went wrong", "suggestion": "How to master this" }],
                  "tips": [{ "text": "General Excel Exam Tip" }]
                }
             `;
        } else {
            return res.status(400).json({ message: "Invalid analysis type." });
        }

        const aiRes = await model.generateContent(analysisPrompt);
        let text = aiRes.response.text();
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const json = JSON.parse(text);

        res.json({ success: true, analysis: json });

    } catch (error) {
        console.error("Exam Analysis Error:", error);
        res.status(500).json({ message: "Failed to generate detailed analysis." });
    }
});

// ============================================================
// PRACTICE ROUTES (No DB writes — results returned directly)
// ============================================================

// --- Practice Letter Submission ---
app.post('/api/practice/letter', authMiddleware, async (req, res) => {
    try {
        const { content, questionId } = req.body;
        const originalQuestion = await LetterQuestion.findById(questionId);
        if (!originalQuestion) return res.status(404).json({ message: 'Letter question not found.' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Deterministic format checks (same as exam)
        const hasTimesNewRoman = /face=["']?Times New Roman["']?/i.test(content) || /font-family\s*:\s*['"]?Times New Roman/i.test(content);
        const hasCorrectFontSize = /size=["']?4["']?/.test(content) || /font-size\s*:\s*12pt/i.test(content);
        const subjectUnderlined = /<u>[^<]*Subject:[^<]*<\/u>/i.test(content) || /<u>\s*<[^>]+>[^<]*Subject:/i.test(content);
        const subjectBold = /<b>[^<]*Subject:[^<]*<\/b>/i.test(content) || /<strong>[^<]*Subject:[^<]*<\/strong>/i.test(content) || /<b>\s*<[^>]+>[^<]*Subject:/i.test(content) || /<strong>\s*<[^>]+>[^<]*Subject:/i.test(content);

        let typographyScore = 0;
        if (hasTimesNewRoman) typographyScore += 1;
        if (hasCorrectFontSize) typographyScore += 1;

        let subjectScore = 0;
        if (subjectUnderlined) subjectScore += 1;
        if (subjectBold) subjectScore += 1;

        const normalizedContent = content.replace(/<span\s+class=["']editor-indent["'][^>]*>\s*<\/span>/gi, '    ');

        const gradingPrompt = `
        You are a formal letter examiner.
        Below is the letter content you must grade:
        ---
        ${normalizedContent}
        ---
        Formatting facts (already verified by system):
        - Font: ${hasTimesNewRoman ? 'Times New Roman detected' : 'Not detected'}
        - Font Size: ${hasCorrectFontSize ? '12pt detected' : 'Not detected'}
        - Subject Underlined: ${subjectUnderlined}
        - Subject Bold: ${subjectBold}

        Grade ONLY these categories (Total 6 Marks):
        1. Content relevance (3 marks): Does it address "${originalQuestion.questionText}"?
        2. Traditional layout (2 marks): Check paragraphing and spacing.
        3. Presentation (1 mark): General formal appearance.

        Return ONLY JSON:
        {
          "content": { "score": integer, "explanation": "string" },
          "format": { "score": integer, "explanation": "string" },
          "presentation": { "score": integer, "explanation": "string" }
        }
        Note: Explanations must be brief (1 sentence). Use whole numbers for scores.
        `;

        const aiResult = await model.generateContent(gradingPrompt);
        const responseText = aiResult.response.text();

        let aiGrade;
        try {
            const cleanJson = responseText.replace(/```json|```/g, '').trim();
            aiGrade = JSON.parse(cleanJson);
        } catch (err) {
            return res.status(500).json({ message: 'AI evaluation failed' });
        }

        const scores = {
            content: Math.round(aiGrade.content.score || 0),
            format: Math.round(aiGrade.format.score || 0),
            presentation: Math.round(aiGrade.presentation.score || 0),
            typography: typographyScore,
            subject: subjectScore
        };
        const totalScore = Math.min(10, scores.content + scores.format + scores.presentation + scores.typography + scores.subject);

        res.json({
            success: true,
            score: totalScore,
            maxScore: 10,
            breakdown: [
                { label: 'Content Relevance', score: scores.content, max: 3, explanation: aiGrade.content.explanation },
                { label: 'Layout & Structure', score: scores.format, max: 2, explanation: aiGrade.format.explanation },
                { label: 'Presentation', score: scores.presentation, max: 1, explanation: aiGrade.presentation.explanation },
                { label: 'Typography (Font)', score: scores.typography, max: 2, explanation: scores.typography === 2 ? 'Correct font and size used.' : 'Issues with font family or size.' },
                { label: 'Subject Emphasis', score: scores.subject, max: 2, explanation: scores.subject === 2 ? 'Subject correctly bolded and underlined.' : 'Subject missing bold or underline.' }
            ]
        });

    } catch (error) {
        console.error('Practice Letter Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Practice Excel Submission ---
app.post('/api/practice/excel', authMiddleware, uploadToCloudinary.single('excelFile'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        const { questionId } = req.body;
        const originalQuestion = await ExcelQuestion.findById(questionId);
        if (!originalQuestion) return res.status(404).json({ message: 'Excel question not found.' });

        const solutionFileResponse = await axios.get(originalQuestion.solutionFilePath, { responseType: 'arraybuffer' });
        const solutionFileBuffer = Buffer.from(solutionFileResponse.data);

        const userFileResponse = await axios.get(req.file.path, { responseType: 'arraybuffer' });
        const userFileBuffer = Buffer.from(userFileResponse.data);

        const solutionWorkbook = new ExcelJS.Workbook();
        await solutionWorkbook.xlsx.load(solutionFileBuffer);
        const solutionSheet1 = solutionWorkbook.getWorksheet(1);
        const solutionSheet2 = solutionWorkbook.getWorksheet(2);
        if (!solutionSheet1 || !solutionSheet2) {
            return res.status(400).json({ message: 'Solution file is missing required worksheets.' });
        }
        const solutionSheet1Data = JSON.stringify(solutionSheet1.getSheetValues());
        const solutionSheet2Instructions = JSON.stringify(solutionSheet2.getSheetValues());

        const userWorkbook = new ExcelJS.Workbook();
        await userWorkbook.xlsx.load(userFileBuffer);
        const userSheet1Data = JSON.stringify(userWorkbook.getWorksheet(1).getSheetValues());

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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

            Return ONLY a JSON object in this exact format:
            { 
            "score": <number_out_of_20>, 
            "feedback": "<string_point-by-point_feedback>" 
            }
            Note: You MUST provide the feedback as a single string where each observation starts with a number (1., 2., etc.) and is separated by a newline (\\n).
        `;

        const result = await model.generateContent(gradingPrompt);
        const responseText = await result.response.text();

        let grade;
        try {
            const cleanedText = responseText.replace(/```json|```/g, '').trim();
            grade = JSON.parse(cleanedText);
        } catch (parseError) {
            grade = { score: 0, feedback: 'Automated grading failed due to an unexpected format from the AI.' };
        }

        res.json({
            success: true,
            score: grade.score,
            maxScore: 20,
            feedback: grade.feedback
        });

    } catch (error) {
        console.error('Practice Excel Error:', error);
        next(error);
    }
});

// --- Detailed AI Analysis (for both letter and excel practice) ---
app.post('/api/practice/analyze', authMiddleware, async (req, res) => {
    try {
        const { type, content, questionId, previousFeedback } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let questionText = '';
        if (type === 'letter') {
            const q = await LetterQuestion.findById(questionId);
            questionText = q ? q.questionText : 'Unknown question';
        } else if (type === 'excel') {
            const q = await ExcelQuestion.findById(questionId);
            questionText = q ? q.questionName : 'Unknown question';
        }

        const analysisPrompt = `
You are a detailed and constructive exam tutor. The student just completed a practice ${type} test.

Question/Task: "${questionText}"

${type === 'letter' ? `Their Letter Content:\n---\n${content}\n---` : ''}

Previous Grading Feedback:
${previousFeedback}

Return ONLY a valid JSON object (no markdown fences, no extra text) with this exact structure:
{
  "strengths": [
    { "title": "Short strength title", "detail": "1-2 sentence explanation" }
  ],
  "improvements": [
    { "title": "Short area title", "detail": "What was wrong", "suggestion": "How to fix it" }
  ],
  "tips": [
    { "text": "Actionable tip" }
  ],
  ${type === 'letter' ? '"sampleStructure": "Brief outline of ideal letter structure for this question, use \\n for line breaks"' : '"keyConcepts": "Remind them of key concepts tested and common pitfalls, use \\n for line breaks"'}
}

Include 2-3 items in each array. Be encouraging but honest.
        `;

        const result = await model.generateContent(analysisPrompt);
        let analysisText = result.response.text();

        // Try to parse as JSON, fallback to raw text
        try {
            const cleaned = analysisText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            res.json({ success: true, analysis: parsed, structured: true });
        } catch {
            res.json({ success: true, analysis: analysisText, structured: false });
        }

    } catch (error) {
        console.error('Practice Analysis Error:', error);
        res.status(500).json({ message: 'Failed to generate analysis.' });
    }
});

// --- AI Typing Coach (personalized improvement advice) ---
app.post('/api/practice/typing-analyze', authMiddleware, async (req, res) => {
    try {
        const { wpm, accuracy, totalChars, correctChars, errorCount, duration, errorDetails } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const analysisPrompt = `
You are a typing coach. A student completed a practice session. Return a JSON object (no markdown fences) with this EXACT structure:

{
  "level": "Beginner|Average|Proficient|Advanced|Expert",
  "summary": "1-2 sentence encouraging summary of their performance",
  "speedTip": "1-2 sentence specific tip for improving speed",
  "accuracyTip": "1-2 sentence specific tip for improving accuracy",
  "drills": [
    {
      "name": "Short drill name",
      "text": "exact text to type repeatedly",
      "reps": 10,
      "target": "which weakness this fixes"
    }
  ],
  "warmup": [
    "Minute 1: description",
    "Minute 2: description",
    "Minute 3: description",
    "Minute 4: description",
    "Minute 5: description"
  ],
  "goalWpm": ${Math.round(wpm * 1.15)},
  "goalAccuracy": ${Math.min(99, accuracy + 2)}
}

Session: ${wpm} WPM, ${accuracy}% accuracy, ${totalChars} chars, ${errorCount} errors, ${duration}s.
${errorDetails ? `Error patterns:\n${errorDetails}` : 'No specific error patterns.'}

Rules:
- "level": Beginner(<20), Average(20-40), Proficient(40-60), Advanced(60-80), Expert(80+)
- Give 3-5 drills targeting their specific weaknesses. Use actual typeable text sequences.
- If errors on home-row keys: home-row drills. Top row: reach drills. Space errors: word-boundary drills.
- Keep all text SHORT and actionable. No fluff.
- Return ONLY valid JSON, no markdown.
        `;

        const result = await model.generateContent(analysisPrompt);
        let responseText = result.response.text().trim();
        // Strip markdown fences if present
        responseText = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

        let analysis;
        try {
            analysis = JSON.parse(responseText);
        } catch (parseErr) {
            // Fallback if JSON parsing fails
            analysis = {
                level: wpm >= 80 ? 'Expert' : wpm >= 60 ? 'Advanced' : wpm >= 40 ? 'Proficient' : wpm >= 20 ? 'Average' : 'Beginner',
                summary: `You typed at ${wpm} WPM with ${accuracy}% accuracy. Keep practicing to improve!`,
                speedTip: 'Focus on maintaining a steady rhythm without pausing between words.',
                accuracyTip: 'Slow down slightly and prioritize hitting the correct keys.',
                drills: [
                    { name: 'Home Row Basics', text: 'asdf jkl; asdf jkl; fdsa ;lkj', reps: 10, target: 'Finger placement' },
                    { name: 'Common Words', text: 'the and for with that have from', reps: 15, target: 'Speed on frequent words' },
                    { name: 'Top Row Reach', text: 'qwerty uiop qwerty uiop', reps: 10, target: 'Top row accuracy' }
                ],
                warmup: ['Minute 1: Home row warm-up', 'Minute 2: Common words', 'Minute 3: Full sentences', 'Minute 4: Speed push', 'Minute 5: Accuracy focus'],
                goalWpm: Math.round(wpm * 1.15),
                goalAccuracy: Math.min(99, accuracy + 2)
            };
        }

        res.json({ success: true, analysis });

    } catch (error) {
        console.error('Typing Analysis Error:', error);
        res.status(500).json({ message: 'Failed to generate typing analysis.' });
    }
});

app.get('/api/results/:sessionId', authMiddleware, async (req, res) => {
    try {
        const result = await TestResult.findOne({
            sessionId: req.params.sessionId,
            user: req.userId
        });

        if (!result) return res.status(404).json({ message: "Result session not found." });

        // --- BRANCH A: New Pattern Logic ---
        if (result.testPattern === 'new_pattern') {
            const details = Array.isArray(result.mcqDetails) ? result.mcqDetails : [];
            const qIds = details.map(d => d.questionId).filter(id => id);

            // Fetch questions from the bank
            const questions = await MCQQuestion.find({ _id: { $in: qIds } });

            const mcqReviewData = details.map(attempt => {
                const qInfo = questions.find(q => q._id.toString() === attempt.questionId.toString());
                return {
                    questionText: qInfo ? qInfo.questionText : "This question was deleted.",
                    options: qInfo ? qInfo.options : ["N/A", "N/A", "N/A", "N/A"],
                    correctAnswer: qInfo ? qInfo.correctAnswerIndex : 0,
                    userAnswer: attempt.userAnswer ?? null
                };
            });

            return res.json({ ...result._doc, mcqReviewData });
        }

        // --- BRANCH B: Standard Pattern Logic (FIXED) ---
        // Just return the document as is. Do not try to process mcqReviewData.
        return res.json(result);

    } catch (error) {
        console.error("CRITICAL API ERROR:", error);
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
});

app.get('/api/results/percentile/:sessionId', authMiddleware, async (req, res) => {
    try {
        const currentResult = await TestResult.findOne({
            sessionId: req.params.sessionId,
            user: req.userId
        });

        if (!currentResult) return res.status(404).json({ message: "Result not found" });

        // 1. Determine the pattern pool (Standard vs New)
        const pattern = currentResult.testPattern || 'standard';
        const currentScore = currentResult.totalScore || 0;

        // 2. Count ONLY participants who took the same exam pattern
        const totalInPool = await TestResult.countDocuments({
            testPattern: pattern,
            status: 'completed'
        });

        // 3. Count how many scored less than or equal to this user in that pool
        const scoredLower = await TestResult.countDocuments({
            testPattern: pattern,
            status: 'completed',
            totalScore: { $lte: currentScore }
        });

        // 4. Calculate Percentile
        const percentile = totalInPool > 0
            ? ((scoredLower / totalInPool) * 100).toFixed(1)
            : 100;

        res.json({
            percentile: parseFloat(percentile),
            totalParticipants: totalInPool,
            patternPool: pattern === 'new_pattern' ? "10+5 MCQ Pattern" : "Standard Pattern"
        });

    } catch (error) {
        console.error("Percentile Error:", error);
        res.status(500).json({ message: "Error calculating percentile" });
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

let leaderboardCache = {
    all: null,
    week: null,
    month: null
};
let lastCacheTime = {
    all: 0,
    week: 0,
    month: 0
};

app.get('/api/leaderboard/all', async (req, res) => {
    const timeframe = req.query.timeframe || 'all'; // 'all', 'week', 'month'
    const now = Date.now();

    // 1. Serve from cache if fresh (within 60 seconds)
    if (leaderboardCache[timeframe] && (now - lastCacheTime[timeframe] < 60000)) {
        return res.json(leaderboardCache[timeframe]);
    }

    try {
        const limit = 25; // Increased from 10 to 25
        
        // Date Filtering
        let dateFilter = {};
        if (timeframe === 'week') {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            dateFilter = { submittedAt: { $gte: lastWeek } };
        } else if (timeframe === 'month') {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            dateFilter = { submittedAt: { $gte: lastMonth } };
        }

        const baseQuery = { attemptMode: 'exam', status: 'completed', ...dateFilter };

        const [
            std_overall,
            std_typing,
            std_letter,
            std_excel,
            new_overall,
            new_typing,
            new_mcq
        ] = await Promise.all([
            // 1. Standard Pattern - Overall
            TestResult.find({ ...baseQuery, testPattern: 'standard' })
                .sort({ totalScore: -1 }).limit(limit).populate('user', 'username'),

            // 2. Standard Pattern - Typing
            TestResult.find({ ...baseQuery, testPattern: 'standard' })
                .sort({ wpm: -1 }).limit(limit).populate('user', 'username'),

            // 3. Standard Pattern - Letter
            TestResult.find({ ...baseQuery, testPattern: 'standard' })
                .sort({ letterScore: -1 }).limit(limit).populate('user', 'username'),

            // 4. Standard Pattern - Excel
            TestResult.find({ ...baseQuery, testPattern: 'standard' })
                .sort({ excelScore: -1 }).limit(limit).populate('user', 'username'),

            // 5. New Pattern - Overall
            TestResult.find({ ...baseQuery, testPattern: 'new_pattern' })
                .sort({ totalScore: -1 }).limit(limit).populate('user', 'username'),

            // 6. New Pattern - Typing
            TestResult.find({ ...baseQuery, testPattern: 'new_pattern' })
                .sort({ typingScore: -1, wpm: -1, accuracy: -1 }).limit(limit).populate('user', 'username'),

            // 7. New Pattern - Excel MCQ
            TestResult.find({ ...baseQuery, testPattern: 'new_pattern' })
                .sort({ mcqScore: -1 }).limit(limit).populate('user', 'username')
        ]);

        const results = {
            std_overall,
            std_typing,
            std_letter,
            std_excel,
            new_overall,
            new_typing,
            new_mcq
        };
        
        leaderboardCache[timeframe] = results;
        lastCacheTime[timeframe] = now;
        res.json(results);

    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        res.status(500).json({ message: "Failed to load rankings." });
    }
});

// --- NEW LEADERBOARD ROUTES ---

// 1. Get User's Rank & Percentile
app.get('/api/leaderboard/my-rank', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const patterns = ['standard', 'new_pattern'];
        const response = {};

        for (const pattern of patterns) {
            // Find user's best score for this pattern
            const userBest = await TestResult.findOne({ 
                user: userId, 
                testPattern: pattern, 
                attemptMode: 'exam', 
                status: 'completed' 
            }).sort({ totalScore: -1 });

            if (!userBest) {
                response[pattern] = null;
                continue;
            }

            // Count users with higher scores
            const betterCount = await TestResult.countDocuments({
                testPattern: pattern,
                attemptMode: 'exam',
                status: 'completed',
                totalScore: { $gt: userBest.totalScore }
            });

            // Count total unique users for this pattern
            const totalUsersList = await TestResult.distinct('user', {
                testPattern: pattern,
                attemptMode: 'exam',
                status: 'completed'
            });
            const totalUsers = totalUsersList.length;

            // Calculate Rank and Percentile
            const rank = betterCount + 1; // 1-based rank
            const percentile = totalUsers > 1 
                ? Math.round(((totalUsers - rank) / totalUsers) * 100) 
                : 100;

            // Trend: Compare latest vs previous
            const latestTwo = await TestResult.find({
                user: userId,
                testPattern: pattern,
                attemptMode: 'exam',
                status: 'completed'
            }).sort({ submittedAt: -1 }).limit(2);

            let trend = null;
            if (latestTwo.length === 2) {
                const latest = latestTwo[0];
                const prev = latestTwo[1];
                trend = {
                    latestScore: latest.totalScore,
                    previousScore: prev.totalScore,
                    delta: latest.totalScore - prev.totalScore,
                    direction: latest.totalScore >= prev.totalScore ? 'up' : 'down'
                };
            }

            response[pattern] = {
                rank,
                totalUsers,
                percentile,
                bestResult: userBest,
                trend
            };
        }

        res.json(response);
    } catch (error) {
        console.error("My Rank Error:", error);
        res.status(500).json({ message: "Failed to fetch rank." });
    }
});

// 2. Compare with another result
app.get('/api/leaderboard/compare/:resultId', authMiddleware, async (req, res) => {
    try {
        const targetResultId = req.params.resultId;
        const userId = req.user.id;

        // Fetch the target result (Them)
        const them = await TestResult.findById(targetResultId).populate('user', 'username');
        if (!them) return res.status(404).json({ message: "Result not found" });

        // Fetch current user's BEST result for the same pattern (You)
        const you = await TestResult.findOne({
            user: userId,
            testPattern: them.testPattern,
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ totalScore: -1 });

        if (!you) {
            return res.json({ 
                them, 
                you: null, 
                message: "You haven't completed a test in this pattern yet." 
            });
        }

        // Calculate Gaps
        const gaps = [];
        
        // Helper to push gaps
        const addGap = (label, youVal, themVal, tipGood, tipBad) => {
            const diff = youVal - themVal;
            const isBetter = diff >= 0;
            gaps.push({
                category: label,
                you: youVal,
                them: themVal,
                diff,
                isBetter,
                tip: isBetter ? tipGood : tipBad
            });
        };

        if (them.testPattern === 'standard') {
            addGap('Typing Speed (WPM)', you.wpm || 0, them.wpm || 0, 
                "You're faster! Keep maintaining accuracy.", "Focus on rhythm to boost speed.");
            addGap('Letter Writing', you.letterScore || 0, them.letterScore || 0, 
                "Great formatting skills!", "Check formatting and salutations.");
            addGap('Excel', you.excelScore || 0, them.excelScore || 0, 
                "Excel-lent work!", "Review formulas and cell formatting.");
        } else {
            addGap('Typing Score', you.typingScore || 0, them.typingScore || 0,
                "Strong typing performance!", "Practice touch typing to improve.");
            addGap('Excel MCQ', you.mcqScore || 0, them.mcqScore || 0,
                "Solid theoretical knowledge.", "Review Excel shortcuts and functions.");
        }

        addGap('Total Score', you.totalScore, them.totalScore, 
            "You're ahead overall!", "Keep practicing to close the gap!");

        res.json({ them, you, gaps });

    } catch (error) {
        console.error("Compare Error:", error);
        res.status(500).json({ message: "Comparison failed" });
    }
});

// 3. Get User Achievements (Computed on fly)
app.get('/api/user/achievements', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const results = await TestResult.find({ 
            user: userId, 
            attemptMode: 'exam', 
            status: 'completed' 
        }).sort({ submittedAt: 1 }); // Oldest first for "First Steps" check

        const stats = {
            totalExams: results.length,
            maxWpm: 0,
            maxAccuracy: 0,
            maxMcq: 0,
            maxLetter: 0,
            hasImprovement: false
        };

        // Compute aggregations
        if (results.length > 0) {
            stats.maxWpm = Math.max(...results.map(r => r.wpm || 0));
            stats.maxAccuracy = Math.max(...results.map(r => r.accuracy || 0));
            stats.maxMcq = Math.max(...results.map(r => r.mcqScore || 0));
            stats.maxLetter = Math.max(...results.map(r => r.letterScore || 0));
            
            // Check for simple improvement (current > previous at least once)
            for (let i = 1; i < results.length; i++) {
                if (results[i].totalScore > results[i-1].totalScore + 5) {
                    stats.hasImprovement = true;
                    break;
                }
            }
        }

        // Define Badges
        const allBadges = [
            { id: 'first_steps', name: 'First Steps', icon: '🐣', desc: 'Completed your first exam', condition: stats.totalExams >= 1 },
            { id: 'consistent', name: 'Consistent', icon: '📅', desc: 'Completed 5+ exams', condition: stats.totalExams >= 5 },
            { id: 'veteran', name: 'Veteran', icon: '🎖️', desc: 'Completed 10+ exams', condition: stats.totalExams >= 10 },
            { id: 'speed_demon', name: 'Speed Demon', icon: '⚡', desc: 'Reached 40+ WPM', condition: stats.maxWpm >= 40 },
            { id: 'sharpshooter', name: 'Sharpshooter', icon: '🎯', desc: '95%+ Accuracy in a test', condition: stats.maxAccuracy >= 95 },
            { id: 'perfect_mcq', name: 'Trivia Master', icon: '🧠', desc: 'Scored 20/20 in MCQ', condition: stats.maxMcq >= 20 },
            { id: 'letter_master', name: 'Scribe', icon: '✍️', desc: 'Perfect 10/10 in Letter', condition: stats.maxLetter >= 10 },
            { id: 'rising_star', name: 'Rising Star', icon: '🚀', desc: 'Improved score by 5+ points', condition: stats.hasImprovement }
        ];

        // Filter to earned status
        const response = allBadges.map(b => ({
            ...b,
            earned: b.condition
        }));

        res.json(response);

    } catch (error) {
        console.error("Achievements Error:", error);
        res.status(500).json({ message: "Failed to fetch achievements" });
    }
});

// --- server.js ---
app.get('/api/stats/global', authMiddleware, async (req, res) => {
    try {
        const stats = await TestResult.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: "$testPattern", // Group by Pattern (standard vs new_pattern)

                    // Averages
                    avgTyping: { $avg: "$typingScore" },
                    avgLetter: { $avg: "$letterScore" },
                    avgExcel: { $avg: "$excelScore" },
                    avgMCQ: { $avg: "$mcqScore" },

                    // Max Scores
                    maxTyping: { $max: "$typingScore" },
                    maxLetter: { $max: "$letterScore" },
                    maxExcel: { $max: "$excelScore" },
                    maxMCQ: { $max: "$mcqScore" }
                }
            }
        ]);

        // Transform into a cleaner object for frontend
        const result = {
            standard: stats.find(s => s._id === 'standard') || {},
            new_pattern: stats.find(s => s._id === 'new_pattern') || {}
        };

        // Fill defaults if missing
        const defaultStats = { avgTyping: 0, avgLetter: 0, avgExcel: 0, avgMCQ: 0, maxTyping: 0, maxLetter: 0, maxExcel: 0, maxMCQ: 0 };
        result.standard = { ...defaultStats, ...result.standard };
        result.new_pattern = { ...defaultStats, ...result.new_pattern };

        res.json(result);

    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
});


// --- Admin-Only Routes ---

// --- Admin User Management ---
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
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
});

app.post('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
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
});

app.patch('/api/admin/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
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
});

app.post('/api/admin/users/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
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
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
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
});

app.get('/api/admin/results', authMiddleware, adminMiddleware, async (req, res) => {
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

// adminExcelUpload removed — was unused; the route below uses `upload.fields()` instead
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
                category: data.category,
                difficulty: data.difficulty || 'Medium',
                correctExplanation: data.correctExplanation || ''
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

app.get('/api/debug-key', authMiddleware, adminMiddleware, (req, res) => {
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

        // 1. Find all active sets that the user has NOT completed yet
        let availableSets = await MCQSet.find({
            _id: { $nin: user.completedMCQSets },
            isActive: true
        }).select('_id'); // We only fetch IDs first to keep it fast

        // 2. AUTO-RESET: If the user has completed everything, clear their history
        if (availableSets.length === 0) {
            console.log(`User ${user.email} has seen all sets. Resetting cycle...`);
            user.completedMCQSets = [];
            await user.save();

            // Re-fetch all currently active sets
            availableSets = await MCQSet.find({ isActive: true }).select('_id');
        }

        // 3. Check if there are actually any sets in the system at all
        if (availableSets.length === 0) {
            return res.status(404).json({ message: "No active mock sets are available in the system." });
        }

        // 4. RANDOMIZER: Pick a random ID from the list of available sets
        const randomIndex = Math.floor(Math.random() * availableSets.length);
        const randomSetId = availableSets[randomIndex]._id;

        // 5. Fetch the full set data including questions
        const nextSet = await MCQSet.findById(randomSetId).populate('questions');

        res.json({
            setId: nextSet._id,
            setName: nextSet.setName,
            questions: nextSet.questions
        });
    } catch (error) {
        console.error("Random Set Fetch Error:", error);
        res.status(500).json({ message: "Server error fetching exam set." });
    }
});

// --- GET: Fetch all MCQ Questions for the bank (Paginated) ---
app.get('/api/admin/mcq-questions', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 50, search, category, difficulty } = req.query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (search) filter.questionText = { $regex: search, $options: 'i' };
        if (category) filter.category = category;
        if (difficulty) filter.difficulty = difficulty;

        const total = await MCQQuestion.countDocuments(filter);
        const questions = await MCQQuestion.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        res.json({
            questions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching question bank.' });
    }
});

// --- POST: Create a single MCQ Question manually ---
app.post('/api/admin/mcq-questions', authMiddleware, adminMiddleware, uploadToCloudinary.single('image'), async (req, res) => {
    try {
        const { questionText, options, correctAnswerIndex, category, difficulty, correctExplanation } = req.body;

        let imageUrl = '';
        if (req.file) {
            imageUrl = req.file.path;
        }

        const newQuestion = new MCQQuestion({
            questionText,
            options, // If sending as FormData, ensure this is parsed correctly (e.g. JSON.parse if stringified)
            correctAnswerIndex,
            category: category || 'General',
            difficulty,
            correctExplanation,
            imageUrl
        });
        await newQuestion.save();
        res.status(201).json({ message: 'Question saved to bank!', question: newQuestion });
    } catch (error) {
        console.error("Add MCQ Error:", error);
        res.status(500).json({ message: 'Error saving question.' });
    }
});

// --- POST: Create a 10-Question Mock Set (Admin Only) ---
app.post('/api/admin/mcq-sets', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { setName, questions } = req.body; // 'questions' must match 'admin.js'

        const newSet = new MCQSet({
            setName,
            questions, // This matches the array of 10 IDs
            isActive: true
        });

        await newSet.save();
        res.status(201).json({ success: true, message: 'Set created!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- GET: List all MCQ Sets ---
app.get('/api/admin/mcq-sets', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sets = await MCQSet.find({}).populate('questions', 'questionText category').sort({ createdAt: -1 });
        res.json(sets);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sets.' });
    }
});

// --- PUT: Edit a single MCQ Question ---
app.put('/api/admin/mcq-questions/:id', authMiddleware, adminMiddleware, uploadToCloudinary.single('image'), async (req, res) => {
    try {
        const { questionText, options, correctAnswerIndex, category, difficulty, correctExplanation } = req.body;

        const updateData = {
            questionText,
            options,
            correctAnswerIndex,
            category,
            difficulty,
            correctExplanation
        };

        if (req.file) {
            updateData.imageUrl = req.file.path;
        }

        const updated = await MCQQuestion.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Question not found.' });
        res.json({ success: true, message: 'Question updated!', question: updated });
    } catch (error) {
        res.status(500).json({ message: 'Error updating question: ' + error.message });
    }
});

// --- DELETE: Remove a single MCQ Question ---
app.delete('/api/admin/mcq-questions/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const deleted = await MCQQuestion.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Question not found.' });
        // Also remove this question from any sets that reference it
        await MCQSet.updateMany({}, { $pull: { questions: req.params.id } });
        res.json({ success: true, message: 'Question deleted!' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting question.' });
    }
});

// --- DELETE: Remove a MCQ Set ---
app.delete('/api/admin/mcq-sets/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const deleted = await MCQSet.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Set not found.' });
        res.json({ success: true, message: 'Set deleted!' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting set.' });
    }
});

// --- PATCH: Toggle active/inactive on a MCQ Set ---
app.patch('/api/admin/mcq-sets/:id/toggle', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const set = await MCQSet.findById(req.params.id);
        if (!set) return res.status(404).json({ message: 'Set not found.' });
        set.isActive = !set.isActive;
        await set.save();
        res.json({ success: true, isActive: set.isActive, message: `Set ${set.isActive ? 'activated' : 'deactivated'}.` });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling set.' });
    }
});

// // --- Updated Debug Route (No Middleware Required) ---
// app.get('/api/debug/reset-mcq/:email', async (req, res) => {
//     try {
//         const userEmail = req.params.email;
//         const user = await User.findOneAndUpdate(
//             { email: userEmail },
//             { $set: { completedMCQSets: [] } },
//             { new: true }
//         );

//         if (!user) {
//             return res.status(404).send("User not found. Check the email in the URL.");
//         }

//         res.send(`MCQ Progress Reset for ${userEmail}! You can now take the test again.`);
//     } catch (error) {
//         console.error("Reset Error:", error);
//         res.status(500).send("Error resetting progress.");
//     }
// });
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
                totalScore: finalTotal,
                status: 'completed',
                // Save raw details so the review page can show Green/Red highlights
                mcqDetails: Object.keys(answers).map(qId => ({
                    questionId: qId,
                    userAnswer: answers[qId]
                }))
            },
            { new: true }
        );

        res.json({
            success: true,
            redirectUrl: `/results-new.html?sessionId=${sessionId}`
        });
    } catch (error) {
        res.status(500).json({ message: "Error saving MCQ results." });
    }
});

app.get('/api/mcqs/practice/:category', authMiddleware, async (req, res) => {
    try {
        const { category } = req.params;
        const { difficulty } = req.query;

        // Build match filter
        const matchFilter = {};
        if (category !== 'All') matchFilter.category = category;
        if (difficulty && difficulty !== 'All') matchFilter.difficulty = difficulty;

        const questions = await MCQQuestion.aggregate([
            { $match: matchFilter },
            { $sample: { size: 10 } }
        ]);
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: "Error loading practice questions" });
    }
});

// --- Practice Results Routes ---
app.post('/api/practice/results', authMiddleware, async (req, res) => {
    try {
        const { category, difficulty, score, totalQuestions } = req.body;
        const newResult = new PracticeResult({
            user: req.userId,
            category,
            difficulty,
            score,
            totalQuestions
        });
        await newResult.save();
        res.status(201).json({ success: true, message: 'Practice result saved!' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving practice result.' });
    }
});

app.get('/api/practice/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await PracticeResult.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
                    totalScore: { $sum: "$score" },
                    sessions: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } } // Sort by date ascending
        ]);
        res.json(stats);
    } catch (error) {
        console.error("Practice Stats Error:", error);
        res.status(500).json({ message: 'Error fetching practice stats.' });
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