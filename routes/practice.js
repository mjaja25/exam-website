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
    saveResultBody
} = require('../validation/schemas/practice');

// Practice Letter Submission
router.post('/letter', authMiddleware, validate({ body: submitPracticeLetterBody }), practiceController.submitPracticeLetter);

// Practice Excel Submission — validation after multer
router.post('/excel', authMiddleware, uploadToCloudinary.single('excelFile'), validate({ body: submitPracticeExcelBody }), practiceController.submitPracticeExcel);

// Practice Analysis (General)
router.post('/analyze', authMiddleware, validate({ body: analyzePracticeBody }), practiceController.analyzePractice);

// Practice Typing Analysis
router.post('/typing-analyze', authMiddleware, validate({ body: analyzeTypingPracticeBody }), practiceController.analyzeTypingPractice);

// Practice Results (Save)
router.post('/results', authMiddleware, validate({ body: saveResultBody }), practiceController.saveResult);

// Practice Stats (Get) — no validation needed (user ID from auth)
router.get('/stats', authMiddleware, practiceController.getStats);

module.exports = router;
