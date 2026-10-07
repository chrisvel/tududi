'use strict';

const express = require('express');
const router = express.Router();
const calendarFeedsController = require('./controller');

router.get('/calendar-feeds', calendarFeedsController.list);
router.get('/calendar-feeds/events', calendarFeedsController.events);
router.post('/calendar-feeds', calendarFeedsController.create);
router.patch('/calendar-feeds/:uid', calendarFeedsController.update);
router.delete('/calendar-feeds/:uid', calendarFeedsController.remove);

module.exports = router;
