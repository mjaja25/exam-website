const {
    registerBody,
    loginBody,
    forgotPasswordBody,
    resetPasswordBody,
    verifyEmailQuery
} = require('../../validation/schemas/auth');

describe('Auth validation schemas', () => {
    describe('registerBody', () => {
        it('should accept valid registration data', () => {
            const result = registerBody.safeParse({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            });
            expect(result.success).toBe(true);
        });

        it('should trim username and lowercase email', () => {
            const result = registerBody.safeParse({
                username: '  Alice  ',
                email: 'Alice@Test.COM',
                password: 'password123'
            });
            expect(result.success).toBe(true);
            expect(result.data.username).toBe('Alice');
            expect(result.data.email).toBe('alice@test.com');
        });

        it('should reject empty username', () => {
            const result = registerBody.safeParse({
                username: '',
                email: 'test@example.com',
                password: 'password123'
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid email', () => {
            const result = registerBody.safeParse({
                username: 'testuser',
                email: 'not-an-email',
                password: 'password123'
            });
            expect(result.success).toBe(false);
        });

        it('should reject short password', () => {
            const result = registerBody.safeParse({
                username: 'testuser',
                email: 'test@example.com',
                password: '123'
            });
            expect(result.success).toBe(false);
            const msg = result.error.issues[0].message;
            expect(msg).toContain('at least 6');
        });

        it('should reject missing fields', () => {
            const result = registerBody.safeParse({});
            expect(result.success).toBe(false);
            expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('loginBody', () => {
        it('should accept valid login', () => {
            const result = loginBody.safeParse({
                email: 'user@example.com',
                password: 'pass'
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing password', () => {
            const result = loginBody.safeParse({
                email: 'user@example.com'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('forgotPasswordBody', () => {
        it('should accept valid email', () => {
            const result = forgotPasswordBody.safeParse({ email: 'a@b.com' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid email', () => {
            const result = forgotPasswordBody.safeParse({ email: 'bad' });
            expect(result.success).toBe(false);
        });
    });

    describe('resetPasswordBody', () => {
        it('should accept valid token + password', () => {
            const result = resetPasswordBody.safeParse({
                token: 'abc.def.ghi',
                newPassword: 'newpass123'
            });
            expect(result.success).toBe(true);
        });

        it('should reject short password', () => {
            const result = resetPasswordBody.safeParse({
                token: 'abc',
                newPassword: '12'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('verifyEmailQuery', () => {
        it('should accept valid token', () => {
            const result = verifyEmailQuery.safeParse({ token: 'some-jwt-token' });
            expect(result.success).toBe(true);
        });

        it('should reject empty token', () => {
            const result = verifyEmailQuery.safeParse({ token: '' });
            expect(result.success).toBe(false);
        });
    });
});
