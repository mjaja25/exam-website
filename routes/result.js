const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../validation/middleware');
const { sessionIdParams } = require('../validation/schemas/result');

router.get('/results/:sessionId', authMiddleware, validate({ params: sessionIdParams }), resultController.getSessionResult);
router.get('/results/percentile/:sessionId', authMiddleware, validate({ params: sessionIdParams }), resultController.getPercentile);

module.exports = router;
