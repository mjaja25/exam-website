const { z } = require('zod');
const { objectId } = require('./common');

const submitPracticeLetterBody = z.object({
    content: z.string().min(1, 'Letter content is required'),
    questionId: objectId
});

// File upload route — only questionId in body
const submitPracticeExcelBody = z.object({
    questionId: z.string().min(1, 'Question ID is required')
});

// General practice analysis — uses passthrough because typing analysis
// spreads the entire body as a pseudo-result object ({ ...req.body })
const analyzePracticeBody = z.object({
    type: z.enum(['typing', 'letter', 'excel'], {
        message: 'Type must be typing, letter, or excel'
    }),
    content: z.string().optional(),
    questionId: z.string().optional(),
    previousFeedback: z.string().optional(),
    score: z.number().optional()
}).passthrough();

// Typing-specific practice analysis — passthrough for wpm, accuracy, etc.
const analyzeTypingPracticeBody = z.object({
    wpm: z.number({ message: 'WPM is required' }),
    accuracy: z.number({ message: 'Accuracy is required' })
}).passthrough();

// POST /practice/results
const saveResultBody = z.object({
    category: z.string().min(1, 'Category is required'),
    difficulty: z.string().optional(),
    score: z.number({ message: 'Score is required' }),
    totalQuestions: z.number().int().positive({ message: 'Total questions must be a positive integer' })
});

module.exports = {
    submitPracticeLetterBody,
    submitPracticeExcelBody,
    analyzePracticeBody,
    analyzeTypingPracticeBody,
    saveResultBody
};
