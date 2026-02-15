const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { authMiddleware } = require('../middleware/auth');

// Public Routes (or partially protected if desired, currently public in legacy)
router.get('/', leaderboardController.getTopScores);
router.get('/all', leaderboardController.getAllLeaderboards);

// Protected Routes
router.get('/my-rank', authMiddleware, leaderboardController.getMyRank);
router.get('/compare/:resultId', authMiddleware, leaderboardController.compareResult);

module.exports = router;