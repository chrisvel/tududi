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
            return res
                .status(401)
                .json({ error: 'Invalid or expired API token' });
        }

        const user = await User.findByPk(apiToken.user_id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.currentUser = user;
        req.authToken = apiToken;

        // Update last_used_at asynchronously (non-blocking) to avoid slowing down the request
        // Only update if it hasn't been updated in the last 5 minutes to reduce database writes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (!apiToken.last_used_at || apiToken.last_used_at < fiveMinutesAgo) {
            // Fire and forget - don't await this update
            apiToken.update({ last_used_at: new Date() }).catch((err) => {
                console.error('Failed to update token last_used_at:', err);
            });
        }

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

module.exports = {
    requireAuth,
};
