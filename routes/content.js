const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const { authMiddleware } = require('../middleware/auth');

router.get('/passages/random', authMiddleware, contentController.getRandomPassage);
router.get('/letter-questions/random', authMiddleware, contentController.getRandomLetterQuestion);
router.get('/excel-questions/random', authMiddleware, contentController.getRandomExcelQuestion);

module.exports = router;
