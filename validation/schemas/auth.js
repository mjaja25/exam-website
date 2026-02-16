const { z } = require('zod');

const registerBody = z.object({
    username: z.string().trim().min(1, 'Username is required'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginBody = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
});

const forgotPasswordBody = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address')
});

const resetPasswordBody = z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

const verifyEmailQuery = z.object({
    token: z.string().min(1, 'Token is required')
});

module.exports = {
    registerBody,
    loginBody,
    forgotPasswordBody,
    resetPasswordBody,
    verifyEmailQuery
};
