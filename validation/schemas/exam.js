const { z } = require('zod');
const { objectId } = require('./common');

const submitTypingBody = z.object({
    wpm: z.number({ message: 'WPM must be a number' }).min(0),
    accuracy: z.number({ message: 'Accuracy must be a number' }).min(0).max(100),
    sessionId: z.string().min(1, 'Session ID is required'),
    testPattern: z.enum(['standard', 'new_pattern']).optional(),
    // Detailed metrics (optional — sent for AI analysis)
    typingDuration: z.number().optional(),
    totalChars: z.number().int().optional(),
    correctChars: z.number().int().optional(),
    errorCount: z.number().int().optional(),
    typingErrorDetails: z.string().optional()
});

const submitLetterBody = z.object({
    content: z.string().min(1, 'Letter content is required'),
    sessionId: z.string().min(1, 'Session ID is required'),
    questionId: objectId
});

// File upload route — body fields come as strings via multer (multipart)
const submitExcelBody = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    questionId: z.string().min(1, 'Question ID is required')
});

const analyzeExamBody = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    type: z.enum(['typing', 'letter', 'excel'], {
        message: 'Type must be typing, letter, or excel'
    })
});

module.exports = {
    submitTypingBody,
    submitLetterBody,
    submitExcelBody,
    analyzeExamBody
};
