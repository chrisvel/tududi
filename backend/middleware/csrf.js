const lusca = require('lusca');

const csrfMiddleware = lusca.csrf({
    header: 'x-csrf-token',
    cookie: false,
});

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

const generateToken = (req, res) => {
    if (typeof req.csrfToken === 'function') {
        return req.csrfToken();
    }
    if (res.locals._csrf) {
        return res.locals._csrf;
    }
    return '';
};

module.exports = {
    csrfProtection,
    csrfMiddleware,
    generateToken,
};
