/**
 * Shared Zod primitives reused across domain schemas.
 */
const { z } = require('zod');

// MongoDB ObjectId: 24-char hex string
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

// Reusable params schema containing just { id: ObjectId }
const idParam = z.object({
    id: objectId
});

// Coerce query-string numbers (always arrive as strings)
const queryInt = z.coerce.number().int().positive().optional();

module.exports = { objectId, idParam, queryInt };
