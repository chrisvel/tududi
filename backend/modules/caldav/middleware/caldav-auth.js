const bcrypt = require('bcrypt');
const { User } = require('../../../models');
const { findValidTokenByValue } = require('../../users/apiTokenService');
const { caldavAuthLimiter } = require('../../../middleware/rateLimiter');
const { hasFeature } = require('../../../services/entitlementsService');

// CalDAV is a plan feature on hosted instances. Checked once the account
// is known, whichever way it authenticated.
async function planAllows(user, res) {
    if (await hasFeature(user.id, 'caldav')) return true;
    res.status(403).json({ error: 'CalDAV is not included in your plan' });
    return false;
}

async function caldavAuth(req, res, next) {
    try {
        if (req.session?.userId) {
            const user = await User.findByPk(req.session.userId);
            if (user) {
                if (!(await planAllows(user, res))) return;
                req.currentUser = user;
                return next();
            }
        }

        if (req.headers.authorization?.startsWith('Bearer ')) {
            const tokenValue = req.headers.authorization.slice(7);
            const tokenRecord = await findValidTokenByValue(tokenValue);
            if (tokenRecord) {
                const user = await User.findByPk(tokenRecord.user_id);
                if (user) {
                    if (!(await planAllows(user, res))) return;
                    req.currentUser = user;
                    return next();
                }
            }
            return res
                .status(401)
                .set('WWW-Authenticate', 'Basic realm="Tududi CalDAV"')
                .json({ error: 'Invalid or expired token' });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Basic ')) {
            return res
                .status(401)
                .set('WWW-Authenticate', 'Basic realm="Tududi CalDAV"')
                .json({ error: 'Authentication required' });
        }

        const credentials = Buffer.from(
            authHeader.split(' ')[1],
            'base64'
        ).toString('utf8');
        const colonIndex = credentials.indexOf(':');

        if (colonIndex === -1) {
            return res
                .status(401)
                .set('WWW-Authenticate', 'Basic realm="Tududi CalDAV"')
                .json({ error: 'Invalid credentials format' });
        }

        const username = credentials.substring(0, colonIndex);
        const password = credentials.substring(colonIndex + 1);

        // Basic auth is a password login outside the /api limiters, so it
        // gets its own throttle keyed by IP and the attempted username.
        req.caldavUsername = username;
        const limited = await new Promise((resolve) =>
            caldavAuthLimiter(req, res, (err) => resolve(err || null))
        );
        if (res.headersSent) return;
        if (limited) throw limited;

        const user = await User.findOne({
            where: { email: String(username).trim().toLowerCase() },
        });
        // Accounts created through SSO have no password; bcrypt.compare
        // against null would throw and turn a bad login into a 500.
        const isValidPassword = user?.password_digest
            ? await bcrypt.compare(password, user.password_digest)
            : false;
        if (!user || !isValidPassword) {
            return res
                .status(401)
                .set('WWW-Authenticate', 'Basic realm="Tududi CalDAV"')
                .json({ error: 'Invalid credentials' });
        }

        if (!(await planAllows(user, res))) return;
        req.currentUser = user;

        if (req.params.username && req.params.username !== user.email) {
            return res.status(403).json({
                error: 'Access to other users calendars is forbidden',
            });
        }

        next();
    } catch (error) {
        console.error('CalDAV auth error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

module.exports = caldavAuth;
