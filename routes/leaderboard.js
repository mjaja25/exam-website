const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../validation/middleware');
const {
    getTopScoresQuery,
    getAllLeaderboardsQuery,
    compareResultParams
} = require('../validation/schemas/leaderboard');

// Public Routes
router.get('/', validate({ query: getTopScoresQuery }), leaderboardController.getTopScores);
router.get('/all', validate({ query: getAllLeaderboardsQuery }), leaderboardController.getAllLeaderboards);

// Protected Routes
router.get('/my-rank', authMiddleware, leaderboardController.getMyRank);
router.get('/compare/:resultId', authMiddleware, validate({ params: compareResultParams }), leaderboardController.compareResult);

module.exports = router;
