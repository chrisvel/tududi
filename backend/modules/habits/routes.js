'use strict';

const express = require('express');
const router = express.Router();
const habitsController = require('./controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/habits', requireAuth, habitsController.getAll);
router.post('/habits', requireAuth, habitsController.create);
router.post(
    '/habits/:uid/complete',
    requireAuth,
    habitsController.logCompletion
);
router.get(
    '/habits/:uid/completions',
    requireAuth,
    habitsController.getCompletions
);
router.delete(
    '/habits/:uid/completions/:completionId',
    requireAuth,
    habitsController.deleteCompletion
);
router.get('/habits/:uid/stats', requireAuth, habitsController.getStats);
router.put('/habits/:uid', requireAuth, habitsController.update);
router.delete('/habits/:uid', requireAuth, habitsController.delete);

module.exports = router;
