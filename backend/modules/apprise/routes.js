'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { createResourceLimiter } = require('../../middleware/rateLimiter');

router.get('/apprise/config', controller.getConfig);
router.put('/apprise/config', createResourceLimiter, controller.saveConfig);
router.delete('/apprise/config', controller.removeConfig);
router.post('/apprise/test', createResourceLimiter, controller.test);

module.exports = router;
