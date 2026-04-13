const lusca = require('lusca');

const csrfMiddleware = (req, res, next) => {
    if (!req.session) {
        return res.status(500).json({ error: 'Session not initialized' });
    }

    if (!req.session._csrf) {
        req.session._csrf = require('crypto').randomBytes(16).toString('hex');
    }

    next();
};

const csrfProtection = (req, res, next) => {
    if (
        process.env.NODE_ENV === 'test' ||
        req.user ||
        req.headers.authorization?.startsWith('Bearer ')
    ) {
        return next();
    }

    return lusca.csrf({
        header: 'x-csrf-token',
        cookie: false,
    })(req, res, next);
};

const generateToken = (req) => {
    if (!req.session) {
        return '';
    }

    if (!req.session._csrf) {
        req.session._csrf = require('crypto').randomBytes(16).toString('hex');
    }

    return req.session._csrf;
};

module.exports = {
    csrfProtection,
    csrfMiddleware,
    generateToken,
};
