'use strict';

const express = require('express');
const controller = require('./controller');
const { requireRecentAuth } = require('./session');
const { loginLimiter, mfaLimiter } = require('../../middleware/rateLimiter');
const { blockDemoUser } = require('../../middleware/demo');

// Before requireAuth: the session is only half signed in at this point.
const publicRoutes = express.Router();
publicRoutes.post(
    '/login/mfa',
    loginLimiter,
    mfaLimiter,
    controller.completeLogin
);

const routes = express.Router();
routes.get('/profile/mfa', controller.status);
routes.post(
    '/profile/mfa/setup',
    mfaLimiter,
    blockDemoUser,
    controller.startSetup
);
routes.post(
    '/profile/mfa/enable',
    mfaLimiter,
    blockDemoUser,
    controller.enable
);
routes.post('/profile/mfa/disable', mfaLimiter, controller.disable);
routes.post(
    '/profile/mfa/recovery-codes',
    mfaLimiter,
    requireRecentAuth,
    controller.regenerateRecoveryCodes
);
routes.post('/auth/reverify', mfaLimiter, controller.reverify);

module.exports = { publicRoutes, routes };
