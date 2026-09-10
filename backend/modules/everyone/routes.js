'use strict';

const express = require('express');
const router = express.Router();
const everyoneController = require('./controller');

// Aggregated view of every collaborator's shared work, grouped by person.
router.get('/everyone', everyoneController.get);

module.exports = router;
