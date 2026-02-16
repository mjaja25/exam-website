jest.mock('../../models/TestResult');

const TestResult = require('../../models/TestResult');
const leaderboardController = require('../../controllers/leaderboardController');

function createMocks(query = {}, params = {}) {
    const req = {
        query,
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

// Helper to build a chainable mock for Mongoose queries
function chainableMock(resolvedValue) {
    const mock = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(resolvedValue)
    };
    return mock;
}

describe('leaderboardController.getTopScores', () => {
    test('should return top scores for standard pattern', async () => {
        const mockResults = [
            { user: { username: 'alice' }, totalScore: 48 },
            { user: { username: 'bob' }, totalScore: 45 }
        ];

        const chain = chainableMock(mockResults);
        TestResult.find = jest.fn().mockReturnValue(chain);

        const { req, res } = createMocks({ pattern: 'standard' });

        await leaderboardController.getTopScores(req, res);

        expect(TestResult.find).toHaveBeenCalledWith(
            expect.objectContaining({
                testPattern: 'standard',
                attemptMode: 'exam',
                status: 'completed'
            })
        );
        expect(res.json).toHaveBeenCalledWith(mockResults);
    });

    test('should default to standard pattern if none specified', async () => {
        const chain = chainableMock([]);
        TestResult.find = jest.fn().mockReturnValue(chain);

        const { req, res } = createMocks({});

        await leaderboardController.getTopScores(req, res);

        expect(TestResult.find).toHaveBeenCalledWith(
            expect.objectContaining({ testPattern: 'standard' })
        );
    });

    test('should return 500 on database error', async () => {
        TestResult.find = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            populate: jest.fn().mockRejectedValue(new Error('DB error'))
        });

        const { req, res } = createMocks({});

        await leaderboardController.getTopScores(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('leaderboardController.getMyRank', () => {
    test('should return null for pattern with no results', async () => {
        // Make findOne return a chainable mock
        TestResult.findOne = jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(null) // No results for user
        });

        const { req, res } = createMocks();

        await leaderboardController.getMyRank(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                standard: null
            })
        );
    });

    test('should calculate rank and percentile correctly', async () => {
        const mockBestResult = { totalScore: 42 };

        TestResult.findOne = jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockBestResult)
        });

        TestResult.countDocuments = jest.fn().mockResolvedValue(5); // 5 users scored higher

        TestResult.distinct = jest.fn().mockResolvedValue(
            ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'] // 10 total users
        );

        // Latest two results for trend
        TestResult.find = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([
                { totalScore: 42, submittedAt: new Date() },
                { totalScore: 38, submittedAt: new Date() }
            ])
        });

        const { req, res } = createMocks();

        await leaderboardController.getMyRank(req, res);

        const response = res.json.mock.calls[0][0];

        // Rank should be betterCount + 1 = 6
        expect(response.standard.rank).toBe(6);
        // Percentile: (6 / 10) * 100 = 60
        expect(response.standard.percentile).toBe(60);
        // Trend should show improvement
        expect(response.standard.trend.direction).toBe('up');
        expect(response.standard.trend.delta).toBe(4);
    });
});

describe('leaderboardController.compareResult', () => {
    test('should return 404 if target result not found', async () => {
        TestResult.findById = jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null)
        });

        const { req, res } = createMocks({}, { resultId: 'nonexistent' });

        await leaderboardController.compareResult(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should return comparison with gaps for standard pattern', async () => {
        const them = {
            _id: 'result1',
            testPattern: 'standard',
            wpm: 35, letterScore: 7, excelScore: 15, totalScore: 42,
            user: { username: 'rival' }
        };
        const you = {
            _id: 'result2',
            testPattern: 'standard',
            wpm: 40, letterScore: 8, excelScore: 18, totalScore: 48
        };

        TestResult.findById = jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(them)
        });
        TestResult.findOne = jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(you)
        });

        const { req, res } = createMocks({}, { resultId: 'result1' });

        await leaderboardController.compareResult(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.them).toEqual(them);
        expect(response.you).toEqual(you);
        expect(response.gaps).toHaveLength(4); // typing, letter, excel, total
        expect(response.gaps[3].category).toBe('Total Score');
        expect(response.gaps[3].isBetter).toBe(true); // 48 > 42
    });

    test('should handle case where user has no results', async () => {
        const them = {
            testPattern: 'standard', totalScore: 42,
            user: { username: 'rival' }
        };

        TestResult.findById = jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(them)
        });
        TestResult.findOne = jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(null)
        });

        const { req, res } = createMocks({}, { resultId: 'result1' });

        await leaderboardController.compareResult(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.you).toBeNull();
        expect(response.message).toContain("haven't completed");
    });
});
