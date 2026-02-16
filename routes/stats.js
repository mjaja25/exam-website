const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authMiddleware } = require('../middleware/auth');

router.get('/stats/all-tests', authMiddleware, statsController.getAllTestsStats);
router.get('/stats/global', authMiddleware, statsController.getGlobalStats);

module.exports = router;
