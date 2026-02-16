const { z } = require('zod');
const { objectId, idParam } = require('./common');

const MCQ_CATEGORIES = [
    'Formulas', 'Shortcuts', 'Cell Referencing', 'Basic Operations',
    'Formatting', 'Charts', 'Pivot Tables', 'Data Validation', 'Conditional Formatting'
];

// POST /submit/excel-mcq
// Note: controller has a conflicting Array.isArray + object-key access pattern
// for `answers`. We validate sessionId/setId here; controller handles answers.
const submitExcelMCQBody = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    setId: z.string().min(1, 'Set ID is required'),
    answers: z.any() // Controller validates shape (Array.isArray check + length)
});

// GET /mcqs/practice/:category?difficulty=Easy
const practiceQuestionsParams = z.object({
    category: z.string().min(1, 'Category is required')
});
const practiceQuestionsQuery = z.object({
    difficulty: z.string().optional()
});

// POST /admin/mcq-questions  (multipart — numbers arrive as strings)
const createMCQQuestionBody = z.object({
    questionText: z.string().min(1, 'Question text is required'),
    // Options can be a JSON string (from FormData) or an array (from JSON body)
    options: z.any(),
    correctAnswerIndex: z.coerce.number().int().min(0).max(3),
    category: z.enum(MCQ_CATEGORIES, {
        message: `Category must be one of: ${MCQ_CATEGORIES.join(', ')}`
    }).optional().default('General'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
    correctExplanation: z.string().optional()
}).passthrough(); // Allow imageUrl etc. to pass through

// POST /admin/mcq-sets
const createMCQSetBody = z.object({
    setName: z.string().trim().min(1, 'Set name is required'),
    questions: z.array(objectId).length(10, 'A set must contain exactly 10 questions')
});

// PUT /admin/mcq-questions/:id  (same fields as create, all optional)
const updateMCQQuestionBody = z.object({
    questionText: z.string().min(1).optional(),
    options: z.any().optional(),
    correctAnswerIndex: z.coerce.number().int().min(0).max(3).optional(),
    category: z.enum(MCQ_CATEGORIES).optional(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
    correctExplanation: z.string().optional()
}).passthrough();

module.exports = {
    submitExcelMCQBody,
    practiceQuestionsParams,
    practiceQuestionsQuery,
    createMCQQuestionBody,
    createMCQSetBody,
    updateMCQQuestionBody,
    idParam
};
