const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/storage');
const practiceController = require('../controllers/practiceController');

// Practice Letter Submission
router.post('/letter', authMiddleware, practiceController.submitPracticeLetter);

// Practice Excel Submission
router.post('/excel', authMiddleware, uploadToCloudinary.single('excelFile'), practiceController.submitPracticeExcel);

// Practice Analysis (General)
router.post('/analyze', authMiddleware, practiceController.analyzePractice);

// Practice Typing Analysis
router.post('/typing-analyze', authMiddleware, practiceController.analyzeTypingPractice);

// Practice Results (Save)
router.post('/results', authMiddleware, practiceController.saveResult);

// Practice Stats (Get)
router.get('/stats', authMiddleware, practiceController.getStats);

module.exports = router;
