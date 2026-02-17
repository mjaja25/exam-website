const { z } = require('zod');
const { objectId } = require('./common');

const submitPracticeLetterBody = z.object({
    content: z.string().min(1, 'Letter content is required'),
    questionId: objectId
});

const submitPracticeExcelBody = z.object({
    questionId: z.string().min(1, 'Question ID is required')
});

const analyzePracticeBody = z.object({
    type: z.enum(['typing', 'letter', 'excel'], {
        message: 'Type must be typing, letter, or excel'
    }),
    content: z.string().optional(),
    questionId: z.string().optional(),
    previousFeedback: z.string().optional(),
    score: z.number().optional()
}).passthrough();

const analyzeTypingPracticeBody = z.object({
    wpm: z.number({ message: 'WPM is required' }),
    accuracy: z.number({ message: 'Accuracy is required' })
}).passthrough();

const typingErrorSchema = z.object({
    key: z.string(),
    expected: z.string(),
    position: z.number()
});

const keystrokeDataSchema = z.object({
    key: z.string(),
    count: z.number(),
    errors: z.number()
});

const fingerStatsSchema = z.object({
    correct: z.number(),
    errors: z.number()
});

const saveTypingPracticeBody = z.object({
    category: z.string(),
    difficulty: z.string().optional(),
    mode: z.enum(['standard', 'simulation']),
    duration: z.number(),
    wpm: z.number(),
    accuracy: z.number(),
    totalKeystrokes: z.number(),
    correctKeystrokes: z.number(),
    errorCount: z.number(),
    passageId: z.string().optional(),
    passageLength: z.number().optional(),
    errors: z.array(typingErrorSchema),
    keystrokes: z.array(keystrokeDataSchema),
    fingerStats: z.object({
        leftPinky: fingerStatsSchema,
        leftRing: fingerStatsSchema,
        leftMiddle: fingerStatsSchema,
        leftIndex: fingerStatsSchema,
        rightIndex: fingerStatsSchema,
        rightMiddle: fingerStatsSchema,
        rightRing: fingerStatsSchema,
        rightPinky: fingerStatsSchema,
        thumbs: fingerStatsSchema
    }),
    drillType: z.string().nullable().optional(),
    drillRepetitions: z.number().optional()
});

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
    saveTypingPracticeBody,
    saveResultBody
};
