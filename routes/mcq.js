const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/storage');
const multer = require('multer');
const mcqController = require('../controllers/mcqController');
const { validate } = require('../validation/middleware');
const {
    submitExcelMCQBody,
    practiceQuestionsParams,
    practiceQuestionsQuery,
    createMCQQuestionBody,
    createMCQSetBody,
    updateMCQQuestionBody,
    idParam
} = require('../validation/schemas/mcq');

// Configuration for CSV upload
const csvUpload = multer({ dest: 'temp_csv/' });

// --- User Routes ---
router.get('/exam/get-next-set', authMiddleware, mcqController.getNextSet);
router.post('/submit/excel-mcq', authMiddleware, validate({ body: submitExcelMCQBody }), mcqController.submitExcelMCQ);
router.get('/mcqs/practice/:category', authMiddleware, validate({ params: practiceQuestionsParams, query: practiceQuestionsQuery }), mcqController.getPracticeQuestions);

// --- Admin Routes ---
router.get('/admin/mcq-questions', authMiddleware, adminMiddleware, mcqController.getMCQQuestions);
router.post('/admin/mcq-questions', authMiddleware, adminMiddleware, uploadToCloudinary.single('image'), validate({ body: createMCQQuestionBody }), mcqController.createMCQQuestion);
router.put('/admin/mcq-questions/:id', authMiddleware, adminMiddleware, uploadToCloudinary.single('image'), validate({ params: idParam, body: updateMCQQuestionBody }), mcqController.updateMCQQuestion);
router.delete('/admin/mcq-questions/:id', authMiddleware, adminMiddleware, validate({ params: idParam }), mcqController.deleteMCQQuestion);

router.get('/admin/mcq-sets', authMiddleware, adminMiddleware, mcqController.getMCQSets);
router.post('/admin/mcq-sets', authMiddleware, adminMiddleware, validate({ body: createMCQSetBody }), mcqController.createMCQSet);
router.delete('/admin/mcq-sets/:id', authMiddleware, adminMiddleware, validate({ params: idParam }), mcqController.deleteMCQSet);
router.patch('/admin/mcq-sets/:id/toggle', authMiddleware, adminMiddleware, validate({ params: idParam }), mcqController.toggleMCQSet);

router.post('/admin/bulk-mcqs', authMiddleware, adminMiddleware, csvUpload.single('csvFile'), mcqController.bulkUploadMCQ);

module.exports = router;
