const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { upload } = require('../config/storage');
const { validate } = require('../validation/middleware');
const {
    getUsersQuery,
    createUserBody,
    updateUserRoleBody,
    resetUserPasswordBody,
    createPassageBody,
    createLetterQuestionBody,
    createExcelQuestionBody,
    getPassagesQuery,
    getLetterQuestionsQuery,
    getExcelQuestionsQuery,
    idParam
} = require('../validation/schemas/admin');

// User Management
router.get('/users', authMiddleware, adminMiddleware, validate({ query: getUsersQuery }), adminController.getUsers);
router.post('/users', authMiddleware, adminMiddleware, validate({ body: createUserBody }), adminController.createUser);
router.patch('/users/:id/role', authMiddleware, adminMiddleware, validate({ params: idParam, body: updateUserRoleBody }), adminController.updateUserRole);
router.post('/users/:id/reset-password', authMiddleware, adminMiddleware, validate({ params: idParam, body: resetUserPasswordBody }), adminController.resetUserPassword);
router.delete('/users/:id', authMiddleware, adminMiddleware, validate({ params: idParam }), adminController.deleteUser);

// Results
router.get('/results', authMiddleware, adminMiddleware, adminController.getResults);

// Content Management - Passages
router.get('/passages', authMiddleware, adminMiddleware, validate({ query: getPassagesQuery }), adminController.getPassages);
router.post('/passages', authMiddleware, adminMiddleware, validate({ body: createPassageBody }), adminController.createPassage);
router.delete('/passages/:id', authMiddleware, adminMiddleware, validate({ params: idParam }), adminController.deletePassage);

// Content Management - Letter Questions
router.get('/letter-questions', authMiddleware, adminMiddleware, validate({ query: getLetterQuestionsQuery }), adminController.getLetterQuestions);
router.post('/letter-questions', authMiddleware, adminMiddleware, validate({ body: createLetterQuestionBody }), adminController.createLetterQuestion);
router.delete('/letter-questions/:id', authMiddleware, adminMiddleware, validate({ params: idParam }), adminController.deleteLetterQuestion);

// Content Management - Excel Questions (Multiple Files) — validation after multer
router.get('/excel-questions', authMiddleware, adminMiddleware, validate({ query: getExcelQuestionsQuery }), adminController.getExcelQuestions);
router.post('/excel-questions', authMiddleware, adminMiddleware, upload.fields([
    { name: 'questionFile', maxCount: 1 },
    { name: 'solutionFile', maxCount: 1 }
]), validate({ body: createExcelQuestionBody }), adminController.createExcelQuestion);
router.delete('/excel-questions/:id', authMiddleware, adminMiddleware, validate({ params: idParam }), adminController.deleteExcelQuestion);

module.exports = router;
