'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const entitlements = require('../../services/entitlementsService');

// Every billing route disappears on a self-hosted instance.
const requireHosted = (req, res, next) => {
    if (!entitlements.isHostedMode()) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
};

router.use(['/billing', '/admin/billing'], requireHosted);

router.get('/billing', controller.status);
router.get('/billing/plans', controller.catalog);
router.post('/billing/checkout', controller.checkout);
router.post('/billing/portal', controller.portal);
router.post('/billing/sync', controller.sync);

router.get('/admin/billing', controller.adminList);
router.get('/admin/billing/:userId', controller.adminGet);
router.put('/admin/billing/:userId/override', controller.adminSetOverride);
router.delete('/admin/billing/:userId/override', controller.adminClearOverride);
router.post('/admin/billing/:userId/sync', controller.adminSync);

module.exports = router;
