'use strict';

const express = require('express');
const router = express.Router();
const featureFlagsController = require('./controller');

router.get('/feature-flags', featureFlagsController.getAll);

module.exports = router;
