'use strict';

const express = require('express');
const router = express.Router();
const { requireFeature } = require('../../middleware/entitlements');
const telegramController = require('./controller');

router.post(
    '/telegram/start-polling',
    requireFeature('telegram'),
    telegramController.startPolling
);
router.post('/telegram/stop-polling', telegramController.stopPolling);
router.get('/telegram/polling-status', telegramController.getPollingStatus);
router.post(
    '/telegram/setup',
    requireFeature('telegram'),
    telegramController.setup
);
router.post('/telegram/send-welcome', telegramController.sendWelcome);

module.exports = router;
