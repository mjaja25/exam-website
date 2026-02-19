const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/storage');
const practiceController = require('../controllers/practiceController');
const { validate } = require('../validation/middleware');
const {
    submitPracticeLetterBody,
    submitPracticeExcelBody,
    analyzePracticeBody,
    analyzeTypingPracticeBody,
    saveTypingPracticeBody,
    saveResultBody
} = require('../validation/schemas/practice');

// Practice Letter Submission
router.post('/letter', authMiddleware, validate({ body: submitPracticeLetterBody }), practiceController.submitPracticeLetter);

// Practice Excel Submission
router.post('/excel', authMiddleware, uploadToCloudinary.single('excelFile'), validate({ body: submitPracticeExcelBody }), practiceController.submitPracticeExcel);

// Practice Analysis (General)
router.post('/analyze', authMiddleware, validate({ body: analyzePracticeBody }), practiceController.analyzePractice);

// Practice Typing Analysis
router.post('/typing-analyze', authMiddleware, validate({ body: analyzeTypingPracticeBody }), practiceController.analyzeTypingPractice);

// Save Typing Practice with Error Tracking
router.post('/typing', authMiddleware, validate({ body: saveTypingPracticeBody }), practiceController.saveTypingPractice);

// Get Typing Stats
router.get('/typing-stats', authMiddleware, practiceController.getTypingStats);

// Get User Heatmap Data
router.get('/heatmap-data', authMiddleware, practiceController.getUserHeatmapData);

// Excel Hints
router.get('/excel-hints/:questionId', authMiddleware, practiceController.getExcelHints);

// MCQ Stats (for weak-area targeting)
router.get('/mcq-stats', authMiddleware, practiceController.getMcqStats);

// Gamification Profile (XP, streak, badges, daily goals)
router.get('/gamification', authMiddleware, practiceController.getGamificationProfile);

// Practice Results (Save)
router.post('/results', authMiddleware, validate({ body: saveResultBody }), practiceController.saveResult);

// Practice Stats (Get)
router.get('/stats', authMiddleware, practiceController.getStats);

// Unified History Routes
router.get('/typing-history', authMiddleware, practiceController.getTypingHistory);
router.get('/mcq-history', authMiddleware, practiceController.getMcqHistory);
router.get('/letter-history', authMiddleware, practiceController.getLetterHistory);
router.get('/excel-history', authMiddleware, practiceController.getExcelHistory);

module.exports = router;
