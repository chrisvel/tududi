'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { createResourceLimiter } = require('../../middleware/rateLimiter');
const { requireFeature } = require('../../middleware/entitlements');

// Listing and deleting stay open on every plan, so an account that lost the
// feature can still see and remove what it set up.
const webhooksFeature = requireFeature('webhooks');

router.get('/webhooks', controller.list);
router.post(
    '/webhooks',
    createResourceLimiter,
    webhooksFeature,
    controller.create
);
router.patch('/webhooks/:uid', webhooksFeature, controller.update);
router.delete('/webhooks/:uid', controller.remove);
router.post(
    '/webhooks/:uid/secret',
    createResourceLimiter,
    webhooksFeature,
    controller.rotateSecret
);
router.get('/webhooks/:uid/deliveries', controller.deliveries);
router.post(
    '/webhooks/:uid/test',
    createResourceLimiter,
    webhooksFeature,
    controller.test
);

module.exports = router;
