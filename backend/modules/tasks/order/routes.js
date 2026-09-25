const express = require('express');
const { getAuthenticatedUserId } = require('../../../utils/request-utils');
const service = require('./service');

const router = express.Router();

// GET /api/tasks/order?scope=all|project&project_uid=...
router.get('/tasks/order', async (req, res, next) => {
    try {
        res.json(
            await service.getOrder(getAuthenticatedUserId(req), req.query)
        );
    } catch (error) {
        next(error);
    }
});

// PUT /api/tasks/order { scope, project_uid?, task_uids, base_order_by? }
router.put('/tasks/order', async (req, res, next) => {
    try {
        res.json(
            await service.saveOrder(
                getAuthenticatedUserId(req),
                req.body,
                req.currentUser?.timezone
            )
        );
    } catch (error) {
        next(error);
    }
});

module.exports = router;
