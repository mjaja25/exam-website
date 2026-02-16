const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

// Public Config (Auth required)
router.get('/public', authMiddleware, settingsController.getPublicConfig);

// All routes here require Admin access
router.get('/', authMiddleware, adminMiddleware, settingsController.getSettings);
router.put('/', authMiddleware, adminMiddleware, settingsController.updateSettings);

module.exports = router;
