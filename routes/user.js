const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { upload } = require('../config/storage');

router.get('/dashboard', authMiddleware, userController.getDashboard);
router.get('/achievements', authMiddleware, userController.getAchievements);

// Profile Routes
router.patch('/profile', authMiddleware, upload.single('avatar'), userController.updateProfile);

module.exports = router;