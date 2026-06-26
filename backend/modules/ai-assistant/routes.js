'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.get('/ai-assistant/daily-brief', controller.getCachedBrief);
router.post('/ai-assistant/daily-brief', controller.getDailyBrief);
router.get(
    '/ai-assistant/task-insights/:taskUid',
    controller.getCachedTaskInsights
);
router.patch(
    '/ai-assistant/task-insights/:taskUid/dismissed',
    controller.updateTaskInsightsDismissed
);
router.post('/ai-assistant/task-insights', controller.getTaskInsights);
router.get(
    '/ai-assistant/project-insights/:projectUid',
    controller.getCachedProjectInsights
);
router.patch(
    '/ai-assistant/project-insights/:projectUid/dismissed',
    controller.updateProjectInsightsDismissed
);
router.post('/ai-assistant/project-insights', controller.getProjectInsights);

module.exports = router;
