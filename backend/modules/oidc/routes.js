const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/providers', controller.listProviders);

router.get('/auth/:slug', controller.initiateAuth);

router.get('/callback/:slug', controller.handleCallback);

router.post('/link/:slug', requireAuth, controller.initiateLink);

router.delete('/unlink/:identityId', requireAuth, controller.unlinkIdentity);

router.get('/identities', requireAuth, controller.getUserIdentities);

module.exports = router;
