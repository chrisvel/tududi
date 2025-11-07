const { User } = require('../models');
const { findValidTokenByValue } = require('../services/apiTokenService');

const getBearerToken = (req) => {
    const authHeader = req.headers?.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme && token && scheme.toLowerCase() === 'bearer') {
        return token.trim();
    }
    return null;
};

const requireAuth = async (req, res, next) => {
    try {
        // Skip authentication for health check, login routes, and current_user
        const skipPaths = ['/api/health', '/api/login', '/api/current_user'];
        if (skipPaths.includes(req.path) || req.originalUrl === '/api/health') {
            return next();
        }

        if (req.session && req.session.userId) {
            const user = await User.findByPk(req.session.userId);
            if (!user) {
                req.session.destroy();
                return res.status(401).json({ error: 'User not found' });
            }
            req.currentUser = user;
            return next();
        }

        const bearerToken = getBearerToken(req);
        if (!bearerToken) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const apiToken = await findValidTokenByValue(bearerToken);
        if (!apiToken) {
            return res.status(401).json({ error: 'Invalid or expired API token' });
        }

        const user = await User.findByPk(apiToken.user_id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.currentUser = user;
        req.authToken = apiToken;
        await apiToken.update({ last_used_at: new Date() });

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

module.exports = {
    requireAuth,
};
