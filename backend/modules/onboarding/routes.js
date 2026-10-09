'use strict';

const express = require('express');
const router = express.Router();
const onboardingController = require('./controller');

// The welcome screen a new account sees on its first visit to Today. The
// tasks and the plan it makes go through the task and daily-plan routes;
// this only records that the screen is done with, so it never shows again.
router.post('/onboarding/complete', onboardingController.complete);

module.exports = router;
