const bcrypt = require('bcrypt');
const { User } = require('../../../models');

async function caldavAuth(req, res, next) {
    try {
        if (
            req.session?.userId ||
            req.headers.authorization?.startsWith('Bearer ')
        ) {
            if (req.session?.userId) {
                const user = await User.findByPk(req.session.userId);
                if (user) {
                    req.currentUser = user;
                    return next();
                }
            }

            if (req.headers.authorization?.startsWith('Bearer ')) {
                return next();
            }
        }

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Basic ')) {
            return res
                .status(401)
                .set('WWW-Authenticate', 'Basic realm="TaskNoteTaker CalDAV"')
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
                .set('WWW-Authenticate', 'Basic realm="TaskNoteTaker CalDAV"')
                .json({ error: 'Invalid credentials format' });
        }

        const username = credentials.substring(0, colonIndex);
        const password = credentials.substring(colonIndex + 1);

        const user = await User.findOne({ where: { email: username } });
        if (!user) {
            return res
                .status(401)
                .set('WWW-Authenticate', 'Basic realm="TaskNoteTaker CalDAV"')
                .json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(
            password,
            user.password_digest
        );
        if (!isValidPassword) {
            return res
                .status(401)
                .set('WWW-Authenticate', 'Basic realm="TaskNoteTaker CalDAV"')
                .json({ error: 'Invalid credentials' });
        }

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
