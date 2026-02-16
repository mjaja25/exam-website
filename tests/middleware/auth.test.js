const jwt = require('jsonwebtoken');

// Mock the User model
jest.mock('../../models/User', () => ({
    findById: jest.fn()
}));

const { authMiddleware, adminMiddleware } = require('../../middleware/auth');
const User = require('../../models/User');

// Helper to create mock req/res/next
function createMocks(overrides = {}) {
    const req = {
        headers: {},
        ...overrides
    };
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
    const next = jest.fn();
    return { req, res, next };
}

describe('authMiddleware', () => {
    const secret = process.env.JWT_SECRET;

    test('should return 401 if no authorization header', () => {
        const { req, res, next } = createMocks();

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Token missing') })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if authorization header has no token', () => {
        const { req, res, next } = createMocks({
            headers: { authorization: 'Bearer ' }
        });

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token is invalid', () => {
        const { req, res, next } = createMocks({
            headers: { authorization: 'Bearer invalidtoken123' }
        });

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Invalid token') })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token is expired', () => {
        const token = jwt.sign({ userId: 'user123', role: 'user' }, secret, { expiresIn: '-1s' });
        const { req, res, next } = createMocks({
            headers: { authorization: `Bearer ${token}` }
        });

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('should call next and set req.userId/req.user for valid token', () => {
        const token = jwt.sign({ userId: 'user123', role: 'user' }, secret, { expiresIn: '1d' });
        const { req, res, next } = createMocks({
            headers: { authorization: `Bearer ${token}` }
        });

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.userId).toBe('user123');
        expect(req.user).toEqual({ id: 'user123', role: 'user' });
    });

    test('should set admin role from token', () => {
        const token = jwt.sign({ userId: 'admin1', role: 'admin' }, secret, { expiresIn: '1d' });
        const { req, res, next } = createMocks({
            headers: { authorization: `Bearer ${token}` }
        });

        authMiddleware(req, res, next);

        expect(req.user.role).toBe('admin');
    });
});

describe('adminMiddleware', () => {
    test('should return 403 if user is not admin', async () => {
        User.findById.mockResolvedValue({ _id: 'user1', role: 'user' });
        const { req, res, next } = createMocks();
        req.userId = 'user1';

        await adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Admin privileges') })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('should return 403 if user not found', async () => {
        User.findById.mockResolvedValue(null);
        const { req, res, next } = createMocks();
        req.userId = 'nonexistent';

        await adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('should call next if user is admin', async () => {
        User.findById.mockResolvedValue({ _id: 'admin1', role: 'admin' });
        const { req, res, next } = createMocks();
        req.userId = 'admin1';

        await adminMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    test('should return 500 on database error', async () => {
        User.findById.mockRejectedValue(new Error('DB error'));
        const { req, res, next } = createMocks();
        req.userId = 'user1';

        await adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
