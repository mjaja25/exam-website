const { validate } = require('../../validation/middleware');
const { z } = require('zod');

// Helper to create mock req/res/next
const mockReq = (overrides = {}) => ({ body: {}, query: {}, params: {}, ...overrides });
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};
const mockNext = () => jest.fn();

describe('validate middleware', () => {
    const testSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        age: z.number().int().positive()
    });

    it('should call next() on valid body', () => {
        const mw = validate({ body: testSchema });
        const req = mockReq({ body: { name: 'Alice', age: 25 } });
        const res = mockRes();
        const next = mockNext();

        mw(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should replace req.body with parsed data (coercion/stripping)', () => {
        const mw = validate({ body: testSchema });
        const req = mockReq({ body: { name: 'Alice', age: 25, extra: 'stripped' } });
        const res = mockRes();
        const next = mockNext();

        mw(req, res, next);

        expect(req.body).toEqual({ name: 'Alice', age: 25 });
        expect(req.body.extra).toBeUndefined();
    });

    it('should return 400 with structured errors on invalid body', () => {
        const mw = validate({ body: testSchema });
        const req = mockReq({ body: { name: '', age: -1 } });
        const res = mockRes();
        const next = mockNext();

        mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Validation failed',
                errors: expect.arrayContaining([
                    expect.objectContaining({ source: 'body', path: 'name' }),
                    expect.objectContaining({ source: 'body', path: 'age' })
                ])
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('should validate query parameters', () => {
        const querySchema = z.object({
            page: z.coerce.number().int().positive().optional(),
            search: z.string().optional()
        });
        const mw = validate({ query: querySchema });
        const req = mockReq({ query: { page: '3', search: 'test' } });
        const res = mockRes();
        const next = mockNext();

        mw(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.query.page).toBe(3); // coerced from string to number
    });

    it('should validate params', () => {
        const paramSchema = z.object({
            id: z.string().regex(/^[0-9a-fA-F]{24}$/)
        });
        const mw = validate({ params: paramSchema });
        const req = mockReq({ params: { id: '507f1f77bcf86cd799439011' } });
        const res = mockRes();
        const next = mockNext();

        mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should reject invalid params', () => {
        const paramSchema = z.object({
            id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId')
        });
        const mw = validate({ params: paramSchema });
        const req = mockReq({ params: { id: 'not-an-id' } });
        const res = mockRes();
        const next = mockNext();

        mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('should validate multiple sources (body + params) simultaneously', () => {
        const bodySchema = z.object({ role: z.enum(['user', 'admin']) });
        const paramSchema = z.object({ id: z.string().min(1) });
        const mw = validate({ body: bodySchema, params: paramSchema });

        const req = mockReq({
            body: { role: 'invalid' },
            params: { id: '' }
        });
        const res = mockRes();
        const next = mockNext();

        mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        const responseBody = res.json.mock.calls[0][0];
        expect(responseBody.errors.length).toBe(2);
        expect(responseBody.errors[0].source).toBe('body');
        expect(responseBody.errors[1].source).toBe('params');
    });
});
