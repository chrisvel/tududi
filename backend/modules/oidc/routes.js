const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { requireAuth } = require('../../middleware/auth');
const {
    authLimiter,
    authenticatedApiLimiter,
} = require('../../middleware/rateLimiter');

router.get('/providers', controller.listProviders);

router.get('/auth/:slug', authLimiter, controller.initiateAuth);

router.get('/callback/:slug', authLimiter, controller.handleCallback);

router.post(
    '/link/:slug',
    requireAuth,
    authenticatedApiLimiter,
    controller.initiateLink
);

router.delete('/unlink/:identityId', requireAuth, controller.unlinkIdentity);

router.get('/identities', requireAuth, controller.getUserIdentities);

module.exports = router;
