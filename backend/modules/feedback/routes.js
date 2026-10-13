'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { createResourceLimiter } = require('../../middleware/rateLimiter');

// Any signed-in user can send feedback; reading it is admin-only, checked
// in the service.
router.post('/feedback', createResourceLimiter, controller.submit);
router.get('/admin/feedback', controller.list);
router.patch('/admin/feedback/:id', controller.setResolved);
router.delete('/admin/feedback/:id', controller.remove);

module.exports = router;
