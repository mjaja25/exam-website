const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { upload } = require('../config/storage'); // Using 'upload' from storage config for local/fields upload

// Apply Auth and Admin middleware to all routes in this router
// Or apply per route. The server.js used per-route.
// But since this is entirely /api/admin/*, we can apply it globally if we mounted it at /api/admin.
// However, I plan to mount it at /api/admin probably.
// Let's stick to explicit per-route for clarity and safety matching server.js

// User Management
router.get('/users', authMiddleware, adminMiddleware, adminController.getUsers);
router.post('/users', authMiddleware, adminMiddleware, adminController.createUser);
router.patch('/users/:id/role', authMiddleware, adminMiddleware, adminController.updateUserRole);
router.post('/users/:id/reset-password', authMiddleware, adminMiddleware, adminController.resetUserPassword);
router.delete('/users/:id', authMiddleware, adminMiddleware, adminController.deleteUser);

// Results
router.get('/results', authMiddleware, adminMiddleware, adminController.getResults);

// Content Management
router.post('/passages', authMiddleware, adminMiddleware, adminController.createPassage);
router.post('/letter-questions', authMiddleware, adminMiddleware, adminController.createLetterQuestion);

// Excel Questions (Multiple Files)
router.post('/excel-questions', authMiddleware, adminMiddleware, upload.fields([
    { name: 'questionFile', maxCount: 1 },
    { name: 'solutionFile', maxCount: 1 }
]), adminController.createExcelQuestion);

// Debugging
router.get('/debug-gemini', authMiddleware, adminMiddleware, adminController.debugGemini);
router.get('/debug-key', authMiddleware, adminMiddleware, adminController.debugKey);

module.exports = router;
