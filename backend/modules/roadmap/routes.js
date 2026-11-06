'use strict';

const express = require('express');
const router = express.Router();
const roadmapController = require('./controller');

// Goals, areas, projects and tasks over one stretch of time.
router.get('/roadmap', roadmapController.get);

module.exports = router;
