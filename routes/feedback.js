const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../validation/middleware');
const { submitFeedbackBody } = require('../validation/schemas/feedback');

router.post('/feedback', authMiddleware, validate({ body: submitFeedbackBody }), feedbackController.submitFeedback);

module.exports = router;
