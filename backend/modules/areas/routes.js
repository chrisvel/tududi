'use strict';

const express = require('express');
const router = express.Router();
const areasController = require('./controller');

// All routes require authentication (handled by app.js middleware)

router.get('/areas', areasController.list);
router.get('/areas/:uid', areasController.getOne);
router.post('/areas', areasController.create);
router.patch('/areas/:uid', areasController.update);
router.delete('/areas/:uid', areasController.delete);

module.exports = router;
