jest.mock('../../models/TestResult');
jest.mock('../../models/LetterQuestion');
jest.mock('../../models/ExcelQuestion');
jest.mock('../../services/aiGradingService');

const TestResult = require('../../models/TestResult');
const LetterQuestion = require('../../models/LetterQuestion');
const ExcelQuestion = require('../../models/ExcelQuestion');
const aiGradingService = require('../../services/aiGradingService');
const examController = require('../../controllers/examController');

function createMocks(body = {}, params = {}) {
    const req = {
        body,
        params,
        userId: 'user123',
        user: { id: 'user123', role: 'user' }
    };
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
    return { req, res };
}

describe('examController.submitTyping', () => {
    test('should return 400 if required fields missing', async () => {
        const { req, res } = createMocks({ wpm: 35 }); // missing accuracy and sessionId

        await examController.submitTyping(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should calculate standard pattern score correctly (max 20)', async () => {
        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({});

        const { req, res } = createMocks({
            wpm: 35, accuracy: 95, sessionId: 'sess-1', testPattern: 'standard'
        });

        await examController.submitTyping(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, typingScore: 20 })
        );
    });

    test('should calculate new_pattern score correctly (max 30)', async () => {
        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({});

        const { req, res } = createMocks({
            wpm: 35, accuracy: 95, sessionId: 'sess-2', testPattern: 'new_pattern'
        });

        await examController.submitTyping(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, typingScore: 30 })
        );
    });

    test('should cap standard typing score at 20 for high WPM', async () => {
        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({});

        const { req, res } = createMocks({
            wpm: 100, accuracy: 99, sessionId: 'sess-3', testPattern: 'standard'
        });

        await examController.submitTyping(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ typingScore: 20 })
        );
    });

    test('should save detailed metrics', async () => {
        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({});

        const { req, res } = createMocks({
            wpm: 40, accuracy: 90, sessionId: 'sess-4',
            testPattern: 'standard',
            typingDuration: 600, totalChars: 1200, correctChars: 1080,
            errorCount: 12, typingErrorDetails: '{"a":3,"s":2}'
        });

        await examController.submitTyping(req, res);

        expect(TestResult.findOneAndUpdate).toHaveBeenCalledWith(
            { sessionId: 'sess-4', user: 'user123' },
            expect.objectContaining({
                typingDuration: 600,
                totalChars: 1200,
                errorCount: 12
            }),
            { upsert: true, new: true }
        );
    });
});

describe('examController.submitLetter', () => {
    test('should return 400 if required fields missing', async () => {
        const { req, res } = createMocks({ content: 'hello' }); // missing sessionId, questionId

        await examController.submitLetter(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 404 if question not found', async () => {
        LetterQuestion.findById = jest.fn().mockResolvedValue(null);

        const { req, res } = createMocks({
            content: 'Dear Sir...', sessionId: 'sess-1', questionId: 'q1'
        });

        await examController.submitLetter(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should grade and save letter successfully', async () => {
        LetterQuestion.findById = jest.fn().mockResolvedValue({
            _id: 'q1', questionText: 'Write a formal letter'
        });

        aiGradingService.gradeLetter.mockResolvedValue({
            totalScore: 8,
            feedback: 'Content: 3/3 - Great!\nLayout: 2/2 - Good!'
        });

        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({ sessionId: 'sess-1' });

        const { req, res } = createMocks({
            content: '<p>Dear Sir, I am writing...</p>',
            sessionId: 'sess-1',
            questionId: 'q1'
        });

        await examController.submitLetter(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                grade: expect.objectContaining({
                    score: 8,
                    feedback: expect.any(String)
                })
            })
        );
    });

    test('should return 404 if session not found after grading', async () => {
        LetterQuestion.findById = jest.fn().mockResolvedValue({ _id: 'q1', questionText: 'Q' });
        aiGradingService.gradeLetter.mockResolvedValue({ totalScore: 5, feedback: 'Ok' });
        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue(null);

        const { req, res } = createMocks({
            content: 'letter', sessionId: 'invalid-sess', questionId: 'q1'
        });

        await examController.submitLetter(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('examController.submitExcel', () => {
    test('should return 400 if no file uploaded', async () => {
        const { req, res } = createMocks({ sessionId: 'sess-1', questionId: 'q1' });
        // No req.file

        await examController.submitExcel(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 if sessionId or questionId missing', async () => {
        const { req, res } = createMocks({ sessionId: 'sess-1' });
        req.file = { path: '/uploads/test.xlsx' };

        await examController.submitExcel(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should grade excel, calculate total, and complete test', async () => {
        ExcelQuestion.findById = jest.fn().mockResolvedValue({
            _id: 'eq1',
            solutionFilePath: 'http://cloud.com/solution.xlsx',
            questionName: 'Excel Test 1'
        });

        aiGradingService.gradeExcel.mockResolvedValue({
            score: 16,
            feedback: '1. Good\n2. Correct'
        });

        TestResult.findOne = jest.fn().mockResolvedValue({
            sessionId: 'sess-1',
            typingScore: 18,
            letterScore: 8
        });

        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({});

        const { req, res } = createMocks({ sessionId: 'sess-1', questionId: 'eq1' });
        req.file = { path: 'http://cloud.com/user-submission.xlsx' };

        await examController.submitExcel(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Test Completed!',
                total: 42 // 18 + 8 + 16
            })
        );

        // Verify status set to 'completed'
        expect(TestResult.findOneAndUpdate).toHaveBeenCalledWith(
            { sessionId: 'sess-1', user: 'user123' },
            expect.objectContaining({ status: 'completed', totalScore: 42 })
        );
    });
});

describe('examController.analyzeExam', () => {
    test('should return 404 if session not found', async () => {
        TestResult.findOne = jest.fn().mockResolvedValue(null);

        const { req, res } = createMocks({ sessionId: 'nope', type: 'typing' });

        await examController.analyzeExam(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should return analysis for valid session', async () => {
        TestResult.findOne = jest.fn().mockResolvedValue({
            sessionId: 'sess-1', wpm: 40, accuracy: 92
        });

        aiGradingService.analyzePerformance.mockResolvedValue({
            strengths: [{ title: 'Fast', detail: 'Good speed' }],
            improvements: [],
            tips: []
        });

        const { req, res } = createMocks({ sessionId: 'sess-1', type: 'typing' });

        await examController.analyzeExam(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                analysis: expect.objectContaining({ strengths: expect.any(Array) })
            })
        );
    });
});
