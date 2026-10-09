'use strict';

const express = require('express');
const router = express.Router();
const onboardingController = require('./controller');

// The welcome screen a new account sees on its first visit to Today: a
// starter picker that fills areas, goals, projects, habits and a few
// example tasks in one go, and records the choice on the user. The brain
// dump that follows goes through the task and daily-plan routes; complete
// only records that it is done with.
router.post('/onboarding/complete', onboardingController.complete);
router.post('/onboarding/starter', onboardingController.applyStarter);
router.get('/onboarding/examples', onboardingController.countExamples);
router.delete('/onboarding/examples', onboardingController.removeExamples);

module.exports = router;
