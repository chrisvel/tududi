'use strict';

const express = require('express');
const router = express.Router();
const dailyPlanController = require('./controller');

router.get('/daily-plan', dailyPlanController.get);
router.get('/daily-plan/candidates', dailyPlanController.candidates);
router.put('/daily-plan/:date', dailyPlanController.replace);
router.post('/daily-plan/:date/start', dailyPlanController.start);
router.delete('/daily-plan/:date', dailyPlanController.clear);

module.exports = router;
