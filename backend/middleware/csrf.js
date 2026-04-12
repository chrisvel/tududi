const csurf = require('@dr.pogodin/csurf');

const csrfMiddleware = csurf({
    cookie: false,
    value: (req) => {
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

    return csrfMiddleware(req, res, next);
};

const generateToken = (req) => {
    return req.csrfToken ? req.csrfToken() : '';
};

module.exports = {
    csrfProtection,
    csrfMiddleware,
    generateToken,
};
