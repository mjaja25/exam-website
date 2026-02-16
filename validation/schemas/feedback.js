const { z } = require('zod');

const submitFeedbackBody = z.object({
    feedbackType: z.string().min(1, 'Feedback type is required'),
    message: z.string().min(1, 'Message is required')
});

module.exports = { submitFeedbackBody };
