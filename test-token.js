const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'test123', role: 'user' },
  process.env.JWT_SECRET || 'Tadfjaklugbnmaw3485203u9ja',
  { expiresIn: '1h' }
);
console.log(token);
