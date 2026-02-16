const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/storage');
const examController = require('../controllers/examController');
const { validate } = require('../validation/middleware');
const {
    submitTypingBody,
    submitLetterBody,
    submitExcelBody,
    analyzeExamBody
} = require('../validation/schemas/exam');

// Submit Typing Test
router.post('/submit/typing', authMiddleware, validate({ body: submitTypingBody }), examController.submitTyping);

// Submit Letter Test
router.post('/submit/letter', authMiddleware, validate({ body: submitLetterBody }), examController.submitLetter);

// Submit Excel Test (File Upload) — validation runs AFTER multer so body fields are populated
router.post('/submit/excel', authMiddleware, uploadToCloudinary.single('excelFile'), validate({ body: submitExcelBody }), examController.submitExcel);

// Analyze Exam Performance
router.post('/exam/analyze', authMiddleware, validate({ body: analyzeExamBody }), examController.analyzeExam);

module.exports = router;
