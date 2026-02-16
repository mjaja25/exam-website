const { z } = require('zod');
const { idParam } = require('./common');

// GET /admin/users?page=1&limit=20&search=foo&role=admin
const getUsersQuery = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
    role: z.enum(['user', 'admin']).optional()
});

const createUserBody = z.object({
    username: z.string().trim().min(1, 'Username is required'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['user', 'admin']).optional()
});

const updateUserRoleBody = z.object({
    role: z.enum(['user', 'admin'], {
        message: 'Role must be user or admin'
    })
});

const resetUserPasswordBody = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

const createPassageBody = z.object({
    content: z.string().min(100, 'Passage must be at least 100 characters'),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional()
});

const createLetterQuestionBody = z.object({
    questionText: z.string().trim().min(1, 'Question text is required'),
    category: z.enum(['formal', 'informal', 'business']).optional()
});

// File upload route — only questionName comes in body (files handled by multer)
const createExcelQuestionBody = z.object({
    questionName: z.string().trim().min(1, 'Question name is required')
});

// GET /admin/passages?page=1&limit=1&search=foo&difficulty=easy
const getPassagesQuery = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(20).optional(),
    search: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional()
});

// GET /admin/letter-questions?page=1&limit=5&search=foo&category=formal
const getLetterQuestionsQuery = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(20).optional(),
    search: z.string().optional(),
    category: z.enum(['formal', 'business']).optional()
});

// GET /admin/excel-questions?page=1&limit=4&search=foo
const getExcelQuestionsQuery = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(20).optional(),
    search: z.string().optional()
});

module.exports = {
    getUsersQuery,
    createUserBody,
    updateUserRoleBody,
    resetUserPasswordBody,
    createPassageBody,
    createLetterQuestionBody,
    createExcelQuestionBody,
    getPassagesQuery,
    getLetterQuestionsQuery,
    getExcelQuestionsQuery,
    idParam
};
