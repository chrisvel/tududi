const { User, OIDCIdentity } = require('../models');
const { findValidTokenByValue } = require('../modules/users/apiTokenService');
const { validateAccessToken } = require('../modules/oidc/service');

const getBearerToken = (req) => {
    const authHeader = req.headers?.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme && token && scheme.toLowerCase() === 'bearer') {
        return token.trim();
    }
    return null;
};

// Sends a 401 and, when OIDC is enabled, sets WWW-Authenticate so OAuth2 clients
// can discover the authorization server (RFC 9728).
const unauthorized = (res, message) => {
    if (process.env.OIDC_ENABLED === 'true') {
        const baseUrl = process.env.BASE_URL?.replace(/\/$/, ''); // trim trailing slash
        if (baseUrl) {
            res.set(
                'WWW-Authenticate',
                `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
            );
        }
    }
    return res.status(401).json({ error: message });
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
            return unauthorized(res, 'Authentication required');
        }

        if (bearerToken.startsWith('tt_')) {
            // Tududi API key — validate via bcrypt
            const apiToken = await findValidTokenByValue(bearerToken);
            if (!apiToken) {
                return unauthorized(res, 'Invalid or expired API token');
            }

            const user = await User.findByPk(apiToken.user_id);
            if (!user) {
                return unauthorized(res, 'User not found');
            }

            req.currentUser = user;
            req.authToken = apiToken;

            // Update last_used_at asynchronously (non-blocking) to avoid slowing down the request
            // Only update if it hasn't been updated in the last 5 minutes to reduce database writes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (
                !apiToken.last_used_at ||
                apiToken.last_used_at < fiveMinutesAgo
            ) {
                // Fire and forget - don't await this update
                apiToken.update({ last_used_at: new Date() }).catch((err) => {
                    console.error('Failed to update token last_used_at:', err);
                });
            }

            return next();
        }

        // OAuth2 JWT — validate via OIDC provider JWKS
        if (process.env.OIDC_ENABLED === 'true') {
            let payload;
            try {
                payload = await validateAccessToken(bearerToken);
            } catch (err) {
                console.error('JWT validation failed:', err);
                return unauthorized(res, 'Invalid or expired access token');
            }

            const identity = await OIDCIdentity.findOne({
                where: { subject: payload.sub },
                include: [{ model: User, as: 'User' }],
            });

            if (!identity?.User) {
                return unauthorized(
                    res,
                    'No account found for this identity. Please log in via OIDC first.'
                );
            }

            req.currentUser = identity.User;
            return next();
        }

        return unauthorized(res, 'Invalid or expired API token');
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

module.exports = {
    requireAuth,
};
