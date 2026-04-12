const { csrfSync } = require('csrf-sync');

const { generateToken, csrfSynchronisedProtection } = csrfSync({
    getTokenFromRequest: (req) => {
        return req.headers['x-csrf-token'] || req.body?._csrf;
    },
});

const csrfProtection = (req, res, next) => {
    if (
        process.env.NODE_ENV === 'test' ||
        req.user ||
        req.headers.authorization?.startsWith('Bearer ')
    ) {
        return next();
    }

    return csrfSynchronisedProtection(req, res, next);
};

module.exports = {
    generateToken,
    csrfProtection,
    csrfSynchronisedProtection,
};
