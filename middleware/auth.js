const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Authentication failed. Token missing.' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
             return res.status(401).json({ message: 'Authentication failed. Token missing.' });
        }
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decodedToken.userId;
        
        // Populate req.user for convenience (used in some new routes)
        req.user = { id: decodedToken.userId, role: decodedToken.role };
        
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Authentication failed. Invalid token.' });
    }
};

const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (user && user.role === 'admin') {
            next();
        } else {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error checking permissions.' });
    }
};

module.exports = { authMiddleware, adminMiddleware };