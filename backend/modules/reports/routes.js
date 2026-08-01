'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { getGtdReport } = require('./service');
const { logError } = require('../../services/logService');

router.get('/reports/gtd', requireAuth, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const timezone = req.currentUser?.timezone || 'UTC';
        const report = await getGtdReport(userId, timezone);
        res.json(report);
    } catch (err) {
        logError('Error generating GTD report:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

module.exports = router;
