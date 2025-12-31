'use strict';

const express = require('express');
const router = express.Router();
const telegramController = require('./controller');

router.post('/telegram/start-polling', telegramController.startPolling);
router.post('/telegram/stop-polling', telegramController.stopPolling);
router.get('/telegram/polling-status', telegramController.getPollingStatus);
router.post('/telegram/setup', telegramController.setup);
router.post('/telegram/send-welcome', telegramController.sendWelcome);

module.exports = router;
