const express = require('express');
const router = express.Router();

// Import all task route modules
const listRouter = require('./list');
const metricsRouter = require('./metrics');
const crudRouter = require('./crud');
const subtasksRouter = require('./subtasks');
const recurringRouter = require('./recurring');
const toggleRouter = require('./toggle');

// Mount sub-routers
router.use(listRouter);
router.use(metricsRouter);
router.use(crudRouter);
router.use(subtasksRouter);
router.use(recurringRouter);
router.use(toggleRouter);

module.exports = router;
