jest.mock('../../models/TestResult');
jest.mock('../../models/LetterQuestion');
jest.mock('../../models/ExcelQuestion');
jest.mock('../../services/aiGradingService');
jest.mock('../../models/Settings', () => {
    const defaultSettings = {
        typing: {
            standard: { maxMarks: 20, targetWPM: 35, minAccuracy: 90, penalty: 2, bonus: 1, duration: 300 },
            newPattern: { maxMarks: 30, targetWPM: 40, minAccuracy: 90, penalty: 2, bonus: 1, duration: 600 }
        },
        exam: { excelMcqTimerSeconds: 300, letterTimerSeconds: 180, excelPracticalTimerSeconds: 420 }
    };
    const MockSettings = jest.fn().mockImplementation(() => defaultSettings);
    MockSettings.findOne = jest.fn().mockResolvedValue(defaultSettings);
    return MockSettings;
});

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

        // 35 WPM = 35*5 = 175 chars/min. In 5 min = 875 correct chars.
        // totalChars = 875 (95% accuracy → 875/0.95 ≈ 921 total)
        // calculatedWPM = (875/5)/(300/60) = 175/5 = 35 WPM
        // calculatedAccuracy = 875/921 ≈ 95%
        // score = (35/35)*20 - 2 (penalty for 90-95%) = 20 - 2 = 18
        const { req, res } = createMocks({
            sessionId: 'sess-1', testPattern: 'standard',
            typingDuration: 300, totalChars: 921, correctChars: 875
        });

        await examController.submitTyping(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
        const callArg = res.json.mock.calls[0][0];
        expect(callArg.typingScore).toBeGreaterThanOrEqual(0);
        expect(callArg.typingScore).toBeLessThanOrEqual(20);
    });

    test('should calculate new_pattern score correctly (max 30)', async () => {
        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({});

        // 40 WPM at 100% accuracy in 10 min = 40*5*10 = 2000 correct chars
        // calculatedWPM = (2000/5)/(600/60) = 400/10 = 40 WPM
        // calculatedAccuracy = 2000/2000 = 100%
        // score = (40/40)*30 + 1 (bonus for 100%) = 30 + 1 → capped at 30
        const { req, res } = createMocks({
            sessionId: 'sess-2', testPattern: 'new_pattern',
            typingDuration: 600, totalChars: 2000, correctChars: 2000
        });

        await examController.submitTyping(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
        const callArg = res.json.mock.calls[0][0];
        expect(callArg.typingScore).toBe(30); // Capped at max 30
    });

    test('should cap standard typing score at 20 for high WPM', async () => {
        TestResult.findOneAndUpdate = jest.fn().mockResolvedValue({});

        // 100 WPM at 100% accuracy in 5 min = 100*5*5 = 2500 correct chars
        // calculatedWPM = (2500/5)/(300/60) = 500/5 = 100 WPM
        // score = (100/35)*20 + 1 → capped at 20
        const { req, res } = createMocks({
            sessionId: 'sess-3', testPattern: 'standard',
            typingDuration: 300, totalChars: 2500, correctChars: 2500
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
