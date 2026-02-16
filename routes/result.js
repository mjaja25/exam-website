const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authMiddleware } = require('../middleware/auth');

router.get('/results/:sessionId', authMiddleware, resultController.getSessionResult);
router.get('/results/percentile/:sessionId', authMiddleware, resultController.getPercentile);

module.exports = router;
