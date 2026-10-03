'use strict';

const express = require('express');
const router = express.Router();
const inboxController = require('./controller');
const attachmentRoutes = require('./attachmentRoutes');
const { requireFeature } = require('../../middleware/entitlements');

// All routes require authentication (handled by app.js middleware)

router.get('/inbox', inboxController.list);
router.post('/inbox', inboxController.create);
router.post('/inbox/analyze-text', inboxController.analyzeText);
router.post(
    '/inbox/ai/suggest',
    requireFeature('ai'),
    inboxController.aiSuggest
);
router.get('/inbox/:uid', inboxController.getOne);
router.patch('/inbox/:uid', inboxController.update);
router.delete('/inbox/:uid', inboxController.delete);
router.patch('/inbox/:uid/process', inboxController.process);
router.delete('/inbox/:uid/ai-suggestion', inboxController.dismissAiSuggestion);

router.use(attachmentRoutes);

module.exports = router;
