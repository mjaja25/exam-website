const { z } = require('zod');

const sessionIdParams = z.object({
    sessionId: z.string().min(1, 'Session ID is required')
});

module.exports = { sessionIdParams };
