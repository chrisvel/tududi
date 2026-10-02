'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { createResourceLimiter } = require('../../middleware/rateLimiter');

router.get('/push/config', controller.getConfig);
router.get('/push/subscriptions', controller.list);
router.post('/push/subscriptions', createResourceLimiter, controller.subscribe);
router.delete('/push/subscriptions', controller.unsubscribe);

module.exports = router;
