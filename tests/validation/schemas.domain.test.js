const {
    submitTypingBody,
    submitLetterBody,
    submitExcelBody,
    analyzeExamBody
} = require('../../validation/schemas/exam');
const {
    getUsersQuery,
    createUserBody,
    updateUserRoleBody,
    resetUserPasswordBody,
    createPassageBody,
    createLetterQuestionBody,
    createExcelQuestionBody
} = require('../../validation/schemas/admin');
const { submitFeedbackBody } = require('../../validation/schemas/feedback');
const { submitExcelMCQBody, createMCQSetBody } = require('../../validation/schemas/mcq');
const { saveResultBody, submitPracticeLetterBody } = require('../../validation/schemas/practice');
const { getTopScoresQuery, compareResultParams } = require('../../validation/schemas/leaderboard');
const { updateProfileBody } = require('../../validation/schemas/user');

const VALID_OID = '507f1f77bcf86cd799439011';

describe('Exam schemas', () => {
    describe('submitTypingBody', () => {
        it('should accept valid typing submission', () => {
            const result = submitTypingBody.safeParse({
                wpm: 45,
                accuracy: 97.5,
                sessionId: 'sess-123',
                testPattern: 'standard'
            });
            expect(result.success).toBe(true);
        });

        it('should reject negative wpm', () => {
            const result = submitTypingBody.safeParse({
                wpm: -1,
                accuracy: 95,
                sessionId: 'sess'
            });
            expect(result.success).toBe(false);
        });

        it('should reject accuracy > 100', () => {
            const result = submitTypingBody.safeParse({
                wpm: 30,
                accuracy: 101,
                sessionId: 'sess'
            });
            expect(result.success).toBe(false);
        });

        it('should accept optional detailed metrics', () => {
            const result = submitTypingBody.safeParse({
                wpm: 30,
                accuracy: 95,
                sessionId: 'sess',
                typingDuration: 300,
                totalChars: 500,
                correctChars: 475,
                errorCount: 25,
                typingErrorDetails: '{"a":1}'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('submitLetterBody', () => {
        it('should accept valid letter submission', () => {
            const result = submitLetterBody.safeParse({
                content: 'Dear Sir...',
                sessionId: 'sess-123',
                questionId: VALID_OID
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid questionId', () => {
            const result = submitLetterBody.safeParse({
                content: 'text',
                sessionId: 'sess',
                questionId: 'not-an-oid'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('analyzeExamBody', () => {
        it('should accept valid analysis request', () => {
            const result = analyzeExamBody.safeParse({
                sessionId: 'sess-1',
                type: 'typing'
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid type', () => {
            const result = analyzeExamBody.safeParse({
                sessionId: 'sess-1',
                type: 'mcq'
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('Admin schemas', () => {
    describe('getUsersQuery', () => {
        it('should coerce page/limit from strings', () => {
            const result = getUsersQuery.safeParse({ page: '2', limit: '50' });
            expect(result.success).toBe(true);
            expect(result.data.page).toBe(2);
            expect(result.data.limit).toBe(50);
        });

        it('should reject limit > 100', () => {
            const result = getUsersQuery.safeParse({ limit: '200' });
            expect(result.success).toBe(false);
        });

        it('should accept valid role filter', () => {
            const result = getUsersQuery.safeParse({ role: 'admin' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid role', () => {
            const result = getUsersQuery.safeParse({ role: 'superadmin' });
            expect(result.success).toBe(false);
        });
    });

    describe('createUserBody', () => {
        it('should accept valid user creation data', () => {
            const result = createUserBody.safeParse({
                username: 'newuser',
                email: 'new@test.com',
                password: 'pass123',
                role: 'admin'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('updateUserRoleBody', () => {
        it('should accept user or admin', () => {
            expect(updateUserRoleBody.safeParse({ role: 'user' }).success).toBe(true);
            expect(updateUserRoleBody.safeParse({ role: 'admin' }).success).toBe(true);
        });

        it('should reject other roles', () => {
            expect(updateUserRoleBody.safeParse({ role: 'moderator' }).success).toBe(false);
        });
    });

    describe('createPassageBody', () => {
        it('should require min 100 chars content', () => {
            const result = createPassageBody.safeParse({ content: 'short' });
            expect(result.success).toBe(false);
        });

        it('should accept 100+ chars content', () => {
            const result = createPassageBody.safeParse({
                content: 'a'.repeat(100),
                difficulty: 'hard'
            });
            expect(result.success).toBe(true);
        });
    });
});

describe('MCQ schemas', () => {
    describe('createMCQSetBody', () => {
        it('should require exactly 10 question IDs', () => {
            const nineIds = Array(9).fill(VALID_OID);
            expect(createMCQSetBody.safeParse({ setName: 'Set 1', questions: nineIds }).success).toBe(false);

            const tenIds = Array(10).fill(VALID_OID);
            expect(createMCQSetBody.safeParse({ setName: 'Set 1', questions: tenIds }).success).toBe(true);
        });

        it('should reject invalid ObjectIds', () => {
            const ids = Array(10).fill('bad-id');
            expect(createMCQSetBody.safeParse({ setName: 'Set 1', questions: ids }).success).toBe(false);
        });
    });

    describe('submitExcelMCQBody', () => {
        it('should accept valid submission', () => {
            const result = submitExcelMCQBody.safeParse({
                sessionId: 'sess',
                setId: 'set1',
                answers: { q1: 0, q2: 1 }
            });
            expect(result.success).toBe(true);
        });
    });
});

describe('Practice schemas', () => {
    describe('saveResultBody', () => {
        it('should accept valid practice result', () => {
            const result = saveResultBody.safeParse({
                category: 'Formulas',
                score: 8,
                totalQuestions: 10
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing category', () => {
            const result = saveResultBody.safeParse({
                score: 8,
                totalQuestions: 10
            });
            expect(result.success).toBe(false);
        });
    });

    describe('submitPracticeLetterBody', () => {
        it('should accept valid letter practice', () => {
            const result = submitPracticeLetterBody.safeParse({
                content: 'Dear Sir...',
                questionId: VALID_OID
            });
            expect(result.success).toBe(true);
        });
    });
});

describe('Feedback schema', () => {
    it('should accept valid feedback', () => {
        const result = submitFeedbackBody.safeParse({
            feedbackType: 'bug',
            message: 'Something broke'
        });
        expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
        const result = submitFeedbackBody.safeParse({
            feedbackType: 'bug',
            message: ''
        });
        expect(result.success).toBe(false);
    });
});

describe('Leaderboard schemas', () => {
    describe('getTopScoresQuery', () => {
        it('should accept standard or new_pattern', () => {
            expect(getTopScoresQuery.safeParse({ pattern: 'standard' }).success).toBe(true);
            expect(getTopScoresQuery.safeParse({ pattern: 'new_pattern' }).success).toBe(true);
        });

        it('should reject invalid pattern', () => {
            expect(getTopScoresQuery.safeParse({ pattern: 'unknown' }).success).toBe(false);
        });

        it('should allow empty (defaults)', () => {
            expect(getTopScoresQuery.safeParse({}).success).toBe(true);
        });
    });

    describe('compareResultParams', () => {
        it('should accept valid ObjectId', () => {
            expect(compareResultParams.safeParse({ resultId: VALID_OID }).success).toBe(true);
        });

        it('should reject invalid ObjectId', () => {
            expect(compareResultParams.safeParse({ resultId: 'abc' }).success).toBe(false);
        });
    });
});

describe('User schemas', () => {
    describe('updateProfileBody', () => {
        it('should accept valid profile update', () => {
            const result = updateProfileBody.safeParse({
                bio: 'Hello world',
                avatarType: 'default',
                defaultAvatarId: '3'
            });
            expect(result.success).toBe(true);
        });

        it('should reject bio > 150 chars', () => {
            const result = updateProfileBody.safeParse({
                bio: 'x'.repeat(151)
            });
            expect(result.success).toBe(false);
        });

        it('should accept empty object (all optional)', () => {
            expect(updateProfileBody.safeParse({}).success).toBe(true);
        });
    });
});
