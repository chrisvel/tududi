'use strict';

const express = require('express');
const router = express.Router();
const { requireFeature } = require('../../middleware/entitlements');
const telegramController = require('./controller');
const { getConfig } = require('../../config/config');

// Unless TELEGRAM_ENABLED=true the whole API answers as if it did not exist.
router.use('/telegram', (req, res, next) => {
    if (getConfig().telegramEnabled !== true) {
        return res.status(404).json({ error: 'Telegram is turned off' });
    }
    next();
});

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
