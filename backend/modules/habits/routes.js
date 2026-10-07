'use strict';

const express = require('express');
const router = express.Router();
const { requireQuota } = require('../../middleware/entitlements');
const habitsController = require('./controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/habits', requireAuth, habitsController.getAll);
router.post(
    '/habits',
    requireAuth,
    requireQuota('task'),
    habitsController.create
);
router.post(
    '/habits/:uid/complete',
    requireAuth,
    habitsController.logCompletion
);
router.post('/habits/:uid/skip', requireAuth, habitsController.skipDay);
router.get(
    '/habits/:uid/completions',
    requireAuth,
    habitsController.getCompletions
);
router.patch(
    '/habits/:uid/completions/:completionId',
    requireAuth,
    habitsController.updateCompletion
);
router.delete(
    '/habits/:uid/completions/:completionId',
    requireAuth,
    habitsController.deleteCompletion
);
router.get('/habits/:uid/stats', requireAuth, habitsController.getStats);
router.post('/habits/:uid/archive', requireAuth, habitsController.archive);
router.post('/habits/:uid/unarchive', requireAuth, habitsController.unarchive);
router.get('/habits/:uid', requireAuth, habitsController.getOne);
router.put('/habits/:uid', requireAuth, habitsController.update);
router.delete('/habits/:uid', requireAuth, habitsController.delete);

module.exports = router;
