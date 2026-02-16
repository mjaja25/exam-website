const Passage = require('../models/Passage');
const LetterQuestion = require('../models/LetterQuestion');
const ExcelQuestion = require('../models/ExcelQuestion');
const { createDownloadUrl } = require('../utils/helpers');

exports.getRandomPassage = async (req, res) => {
    try {
        const requestedDiff = req.query.difficulty; // Gets 'easy', 'medium', or 'hard' from URL

        // 1. Build the filter object
        let filter = {};
        if (requestedDiff && ['easy', 'medium', 'hard'].includes(requestedDiff)) {
            filter.difficulty = requestedDiff;
        } else {
            // Default for official exams where no difficulty is specified in the URL
            filter.difficulty = 'medium';
        }

        // 2. Count how many passages match this difficulty
        const count = await Passage.countDocuments(filter);

        if (count === 0) {
            // Robustness: fallback if an admin hasn't uploaded passages for a specific level yet
            return res.status(404).json({ message: `No passages found for difficulty: ${filter.difficulty}` });
        }

        // 3. Get one random passage from the filtered list
        const randomIndex = Math.floor(Math.random() * count);
        const passage = await Passage.findOne(filter).skip(randomIndex);

        res.json(passage);
    } catch (error) {
        console.error("FETCH PASSAGE ERROR:", error);
        res.status(500).json({ message: "Server error fetching passage." });
    }
};

exports.getRandomLetterQuestion = async (req, res) => {
    try {
        const count = await LetterQuestion.countDocuments();
        const random = Math.floor(Math.random() * count);
        const question = await LetterQuestion.findOne().skip(random);
        if (!question) return res.status(404).json({ message: 'No letter questions found.' });
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching question.' });
    }
};

exports.getRandomExcelQuestion = async (req, res) => {
    try {
        const count = await ExcelQuestion.countDocuments();
        const random = Math.floor(Math.random() * count);
        let question = await ExcelQuestion.findOne().skip(random).lean(); // Use lean() to modify object

        if (!question) {
            return res.status(404).json({ message: 'No excel questions found.' });
        }

        // Force download for these files
        if (question.questionFilePath) question.questionFilePath = createDownloadUrl(question.questionFilePath);
        if (question.solutionFilePath) question.solutionFilePath = createDownloadUrl(question.solutionFilePath);

        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching question.' });
    }
};
