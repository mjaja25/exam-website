const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authMiddleware } = require('../middleware/auth');

router.post('/feedback', authMiddleware, feedbackController.submitFeedback);

module.exports = router;
