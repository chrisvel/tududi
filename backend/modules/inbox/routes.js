'use strict';

const express = require('express');
const router = express.Router();
const inboxController = require('./controller');

// All routes require authentication (handled by app.js middleware)

router.get('/inbox', inboxController.list);
router.post('/inbox', inboxController.create);
router.post('/inbox/analyze-text', inboxController.analyzeText);
router.get('/inbox/:uid', inboxController.getOne);
router.patch('/inbox/:uid', inboxController.update);
router.delete('/inbox/:uid', inboxController.delete);
router.patch('/inbox/:uid/process', inboxController.process);
router.patch('/inbox/:uid/trash', inboxController.trash);
router.patch('/inbox/:uid/restore', inboxController.restore);

module.exports = router;
