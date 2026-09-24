'use strict';

const express = require('express');
const router = express.Router();
const dailyPlanController = require('./controller');
const { requireFeature } = require('../../middleware/entitlements');

router.get('/daily-plan', dailyPlanController.get);
router.get('/daily-plan/candidates', dailyPlanController.candidates);
router.post(
    '/daily-plan/ai/draft',
    requireFeature('ai'),
    dailyPlanController.aiDraft
);
router.post(
    '/daily-plan/ai/estimates',
    requireFeature('ai'),
    dailyPlanController.aiEstimates
);
router.put('/daily-plan/:date', dailyPlanController.replace);
router.post('/daily-plan/:date/carry-over', dailyPlanController.carryOver);
router.post(
    '/daily-plan/:date/ai/wrap-up',
    requireFeature('ai'),
    dailyPlanController.aiWrapUp
);
router.post('/daily-plan/:date/start', dailyPlanController.start);
router.delete('/daily-plan/:date', dailyPlanController.clear);

module.exports = router;
