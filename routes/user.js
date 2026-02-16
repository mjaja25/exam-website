const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { upload } = require('../config/storage');
const { validate } = require('../validation/middleware');
const { updateProfileBody } = require('../validation/schemas/user');

router.get('/dashboard', authMiddleware, userController.getDashboard);
router.get('/achievements', authMiddleware, userController.getAchievements);

// Profile Routes — validation after multer (file upload)
router.patch('/profile', authMiddleware, upload.single('avatar'), validate({ body: updateProfileBody }), userController.updateProfile);

module.exports = router;
