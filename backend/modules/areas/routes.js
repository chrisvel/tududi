'use strict';

const express = require('express');
const router = express.Router();
const areasController = require('./controller');
const { numericIdParam } = require('../../middleware/numericIdParam');
const { Area } = require('../../models');
const { requireCapability } = require('../../middleware/roles');

// All routes require authentication (handled by app.js middleware)

router.param('uid', numericIdParam('area', Area));

router.get('/areas', areasController.list);
router.get('/areas/:uid', areasController.getOne);
router.post(
    '/areas',
    requireCapability('create_projects'),
    areasController.create
);
router.patch('/areas/:uid', areasController.update);
router.delete('/areas/:uid', areasController.delete);

module.exports = router;
