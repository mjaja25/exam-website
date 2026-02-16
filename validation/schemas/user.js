const { z } = require('zod');

// PATCH /profile — file upload route (multer), all fields optional
const updateProfileBody = z.object({
    bio: z.string().max(150, 'Bio must be 150 characters or less').optional(),
    avatarType: z.string().optional(),
    defaultAvatarId: z.string().optional()
});

module.exports = { updateProfileBody };
