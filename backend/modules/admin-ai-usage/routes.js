'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const entitlements = require('../../services/entitlementsService');

// Meaningless on a self-hosted instance - there's no shared credit pool to
// audit, same rationale as /admin/billing (backend/modules/billing/routes.js).
router.use('/admin/ai-usage', (req, res, next) => {
    if (!entitlements.isHostedMode()) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});

router.get('/admin/ai-usage', controller.list);

module.exports = router;
