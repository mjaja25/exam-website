const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies - manual mock factory for Mongoose model (constructor + statics)
const mockSave = jest.fn();
jest.mock('../../models/User', () => {
    const MockUser = jest.fn().mockImplementation(() => ({
        save: mockSave
    }));
    MockUser.findOne = jest.fn();
    MockUser.findById = jest.fn();
    MockUser.findByIdAndUpdate = jest.fn();
    return MockUser;
});
jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

const User = require('../../models/User');
const authController = require('../../controllers/authController');

function createMocks(body = {}, query = {}) {
    const req = { body, query, headers: {} };
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis()
    };
    return { req, res };
}

describe('authController.register', () => {
    beforeEach(() => {
        User.findOne.mockReset();
        mockSave.mockReset();
    });

    test('should return 400 if required fields are missing', async () => {
        const { req, res } = createMocks({ username: 'test' });

        await authController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('required') })
        );
    });

    test('should return 400 if password is too short', async () => {
        const { req, res } = createMocks({
            username: 'test', email: 'test@test.com', password: '12345'
        });

        await authController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('6 characters') })
        );
    });

    test('should return 409 if email already exists', async () => {
        User.findOne
            .mockResolvedValueOnce({ email: 'test@test.com' }) // existing email
            .mockResolvedValueOnce(null); // username check

        const { req, res } = createMocks({
            username: 'newuser', email: 'test@test.com', password: 'password123'
        });

        await authController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Email') })
        );
    });

    test('should return 409 if username already exists', async () => {
        User.findOne
            .mockResolvedValueOnce(null) // email check
            .mockResolvedValueOnce({ username: 'existinguser' }); // username exists

        const { req, res } = createMocks({
            username: 'existinguser', email: 'new@test.com', password: 'password123'
        });

        await authController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Username') })
        );
    });

    test('should return 201 on successful registration', async () => {
        User.findOne.mockResolvedValue(null); // no existing user
        mockSave.mockResolvedValue(true);

        const { req, res } = createMocks({
            username: 'newuser', email: 'new@test.com', password: 'password123'
        });

        await authController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('successfully') })
        );
    });
});

describe('authController.login', () => {
    test('should return 400 if user not found', async () => {
        User.findOne.mockResolvedValue(null);

        const { req, res } = createMocks({ email: 'noone@test.com', password: 'pass123' });

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Invalid credentials.' })
        );
    });

    test('should return 400 for Google-only user (no password)', async () => {
        User.findOne.mockResolvedValue({
            email: 'google@test.com',
            password: null,
            googleId: 'google123'
        });

        const { req, res } = createMocks({ email: 'google@test.com', password: 'whatever' });

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Google') })
        );
    });

    test('should return 403 if email not verified', async () => {
        User.findOne.mockResolvedValue({
            email: 'unverified@test.com',
            password: 'hashedpass',
            isVerified: false
        });

        const { req, res } = createMocks({ email: 'unverified@test.com', password: 'pass123' });

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('verify') })
        );
    });

    test('should return 400 for wrong password', async () => {
        const hashed = await bcrypt.hash('correctpassword', 10);
        User.findOne.mockResolvedValue({
            _id: 'user1',
            email: 'user@test.com',
            password: hashed,
            isVerified: true,
            role: 'user'
        });

        const { req, res } = createMocks({ email: 'user@test.com', password: 'wrongpassword' });

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Invalid credentials.' })
        );
    });

    test('should return JWT token on successful login', async () => {
        const hashed = await bcrypt.hash('correctpass', 10);
        User.findOne.mockResolvedValue({
            _id: 'user1',
            email: 'user@test.com',
            password: hashed,
            isVerified: true,
            role: 'user'
        });

        const { req, res } = createMocks({ email: 'user@test.com', password: 'correctpass' });

        await authController.login(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ token: expect.any(String) })
        );

        // Verify the token is valid
        const token = res.json.mock.calls[0][0].token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.userId).toBe('user1');
        expect(decoded.role).toBe('user');
    });
});

describe('authController.verifyToken', () => {
    test('should return 200 for valid token check', () => {
        const { req, res } = createMocks();

        authController.verifyToken(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Token is valid.' })
        );
    });
});

describe('authController.forgotPassword', () => {
    test('should return 400 if email is missing', async () => {
        const { req, res } = createMocks({});

        await authController.forgotPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 200 even if user does not exist (anti-enumeration)', async () => {
        User.findOne.mockResolvedValue(null);

        const { req, res } = createMocks({ email: 'nonexistent@test.com' });

        await authController.forgotPassword(req, res);

        // Should NOT return error status - anti-enumeration
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('reset link') })
        );
    });

    test('should detect Google-only accounts', async () => {
        User.findOne.mockResolvedValue({
            email: 'google@test.com',
            password: null,
            googleId: 'google123'
        });

        const { req, res } = createMocks({ email: 'google@test.com' });

        await authController.forgotPassword(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ googleOnly: true })
        );
    });
});

describe('authController.resetPassword', () => {
    test('should return 400 if token or password missing', async () => {
        const { req, res } = createMocks({ token: 'abc' }); // missing newPassword

        await authController.resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 if password too short', async () => {
        const { req, res } = createMocks({ token: 'abc', newPassword: '12345' });

        await authController.resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('6 characters') })
        );
    });

    test('should return 400 for invalid/expired token', async () => {
        const { req, res } = createMocks({
            token: 'invalid-token-value',
            newPassword: 'newpassword123'
        });

        await authController.resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Invalid or expired') })
        );
    });

    test('should successfully reset password with valid token', async () => {
        const resetToken = jwt.sign({ email: 'user@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const mockUser = {
            email: 'user@test.com',
            resetPasswordToken: resetToken,
            resetPasswordExpires: Date.now() + 3600000,
            password: null,
            save: jest.fn().mockResolvedValue(true)
        };
        User.findOne.mockResolvedValue(mockUser);

        const { req, res } = createMocks({
            token: resetToken,
            newPassword: 'newpassword123'
        });

        await authController.resetPassword(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('successfully') })
        );
        expect(mockUser.save).toHaveBeenCalled();
        expect(mockUser.resetPasswordToken).toBeUndefined();
    });
});

describe('authController.googleCallback', () => {
    test('should redirect with JWT token', () => {
        const { req, res } = createMocks();
        req.user = { _id: 'guser1', role: 'user' };

        authController.googleCallback(req, res);

        expect(res.redirect).toHaveBeenCalledWith(
            expect.stringContaining('auth-success.html?token=')
        );
    });
});
