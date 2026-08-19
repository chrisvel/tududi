'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.get('/subscribed-calendars/events', controller.getEvents);
router.get('/subscribed-calendars', controller.getAll);
router.post('/subscribed-calendars', controller.create);
router.delete('/subscribed-calendars/:uid', controller.delete);

module.exports = router;
