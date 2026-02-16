/**
 * Reusable Zod validation middleware for Express.
 *
 * Usage:
 *   const { validate } = require('../validation/middleware');
 *   const { registerBody } = require('../validation/schemas/auth');
 *
 *   router.post('/register', validate({ body: registerBody }), controller.register);
 *   router.get('/users',     validate({ query: getUsersQuery }), controller.getUsers);
 *   router.patch('/users/:id/role', validate({ params: idParam, body: updateRoleBody }), ...);
 */

/**
 * Express middleware factory for Zod validation.
 *
 * @param {Object} schemas - Object with optional `body`, `query`, and/or `params` Zod schemas.
 * @returns {Function} Express middleware
 */
const validate = (schemas) => (req, res, next) => {
    const errors = [];

    for (const [source, schema] of Object.entries(schemas)) {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            for (const issue of result.error.issues) {
                errors.push({
                    source,
                    path: issue.path.join('.'),
                    message: issue.message
                });
            }
        } else {
            // Replace req[source] with parsed (coerced/stripped) data
            req[source] = result.data;
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        });
    }

    next();
};

module.exports = { validate };
