const express = require('express');
const router = express.Router();
const { logError } = require('../../services/logService');
const { computeTaskMetrics, buildMetricsResponse } = require('./helpers');

/**
 * GET /api/tasks/metrics
 * Returns only task metrics (dashboard statistics)
 * Separated from main tasks list for better performance
 */
router.get('/tasks/metrics', async (req, res) => {
    try {
        const metrics = await computeTaskMetrics(
            req.currentUser.id,
            req.currentUser.timezone
        );

        const serializationOptions =
            req.query.type === 'today' ? { preserveOriginalName: true } : {};

        const response = await buildMetricsResponse(
            metrics,
            req.currentUser.timezone,
            serializationOptions
        );

        res.json(response);
    } catch (error) {
        logError('Error fetching task metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
