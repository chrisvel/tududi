const { User } = require('../models');

const requireAuth = async (req, res, next) => {
    try {
        // Skip authentication for health check, login routes, and current_user
        const skipPaths = ['/api/health', '/api/login', '/api/current_user'];
        if (skipPaths.includes(req.path) || req.originalUrl === '/api/health') {
            return next();
        }

        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findByPk(req.session.userId);
        if (!user) {
            req.session.destroy();
            return res.status(401).json({ error: 'User not found' });
        }

        req.currentUser = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

module.exports = {
    requireAuth,
};
