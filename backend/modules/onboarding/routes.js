'use strict';

const express = require('express');
const router = express.Router();
const onboardingController = require('./controller');

// The welcome page every account sees once. The page itself only records
// the visit (starter "empty"); the same endpoint can seed a starter (areas,
// goals, projects, habits, example tasks) for API clients.
router.post('/onboarding/starter', onboardingController.applyStarter);
router.get('/onboarding/examples', onboardingController.countExamples);
router.delete('/onboarding/examples', onboardingController.removeExamples);

module.exports = router;
