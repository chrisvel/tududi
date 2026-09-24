const express = require('express');
const { Task } = require('../../../models');
const { numericIdParam } = require('../../../middleware/numericIdParam');
const { getAuthenticatedUserId } = require('../../../utils/request-utils');
const { logError } = require('../../../services/logService');
const {
    requireTaskReadAccess,
    requireTaskWriteAccess,
} = require('../middleware/access');
const service = require('./service');

const router = express.Router();

router.param('uid', numericIdParam('task', Task));

const loadTask = async (req, res) => {
    const task = await Task.findOne({ where: { uid: req.params.uid } });
    if (!task) {
        res.status(404).json({ error: 'Task not found.' });
        return null;
    }
    return task;
};

const handleError = (res, error, message) => {
    if (error instanceof service.RelationError) {
        return res.status(error.status).json({ error: error.message });
    }
    logError(message, error);
    return res.status(500).json({ error: 'Internal server error' });
};

// GET /api/task/:uid/relations
router.get('/task/:uid/relations', requireTaskReadAccess, async (req, res) => {
    try {
        const task = await loadTask(req, res);
        if (!task) return;
        const relations = await service.listRelations(
            task,
            getAuthenticatedUserId(req)
        );
        res.json({ relations });
    } catch (error) {
        handleError(res, error, 'Error listing task relations:');
    }
});

// POST /api/task/:uid/relations  { target_uid, type }
router.post(
    '/task/:uid/relations',
    requireTaskWriteAccess,
    async (req, res) => {
        try {
            const task = await loadTask(req, res);
            if (!task) return;
            const relation = await service.createRelation({
                task,
                targetUid: req.body?.target_uid,
                type: req.body?.type,
                userId: getAuthenticatedUserId(req),
            });
            res.status(201).json(relation);
        } catch (error) {
            handleError(res, error, 'Error creating task relation:');
        }
    }
);

// DELETE /api/task/:uid/relations/:relationUid
router.delete(
    '/task/:uid/relations/:relationUid',
    requireTaskWriteAccess,
    async (req, res) => {
        try {
            const task = await loadTask(req, res);
            if (!task) return;
            await service.deleteRelation({
                task,
                relationUid: req.params.relationUid,
                userId: getAuthenticatedUserId(req),
            });
            res.status(204).send();
        } catch (error) {
            handleError(res, error, 'Error deleting task relation:');
        }
    }
);

module.exports = router;
