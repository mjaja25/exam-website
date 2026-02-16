// Set test environment variables before any module loads
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.VERIFIED_SENDER_EMAIL = 'test@example.com';
process.env.BASE_URL = 'http://localhost:3000';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-cloud-key';
process.env.CLOUDINARY_API_SECRET = 'test-cloud-secret';
