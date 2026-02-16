const { z } = require('zod');
const { objectId } = require('./common');

const getTopScoresQuery = z.object({
    pattern: z.enum(['standard', 'new_pattern']).optional()
});

const getAllLeaderboardsQuery = z.object({
    timeframe: z.enum(['all', 'week', 'month']).optional()
});

const compareResultParams = z.object({
    resultId: objectId
});

module.exports = {
    getTopScoresQuery,
    getAllLeaderboardsQuery,
    compareResultParams
};
