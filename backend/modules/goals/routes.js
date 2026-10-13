'use strict';

const express = require('express');
const router = express.Router();
const goalsController = require('./controller');
const { requireCapability } = require('../../middleware/roles');

router.get('/goals', goalsController.list);
// Save the current user's custom order of goals
router.put('/goals/order', goalsController.reorder);
router.get('/goals/:uid', goalsController.getOne);
router.post(
    '/goals',
    requireCapability('create_projects'),
    goalsController.create
);
router.patch('/goals/:uid', goalsController.update);
router.delete('/goals/:uid', goalsController.delete);

module.exports = router;
