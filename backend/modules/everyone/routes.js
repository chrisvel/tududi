'use strict';

const express = require('express');
const router = express.Router();
const everyoneController = require('./controller');

// Aggregated view of every collaborator's shared work, grouped by person.
router.get('/everyone', everyoneController.get);

// The same people laid out over time, with dated tasks per person.
router.get('/everyone/timeline', everyoneController.timeline);

module.exports = router;
