const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/storage');
const examController = require('../controllers/examController');

// Submit Typing Test
router.post('/submit/typing', authMiddleware, examController.submitTyping);

// Submit Letter Test
router.post('/submit/letter', authMiddleware, examController.submitLetter);

// Submit Excel Test (File Upload)
router.post('/submit/excel', authMiddleware, uploadToCloudinary.single('excelFile'), examController.submitExcel);

// Analyze Exam Performance
router.post('/exam/analyze', authMiddleware, examController.analyzeExam);

module.exports = router;
