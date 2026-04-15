const express = require('express');
const router = express.Router();
const calendarController = require('./calendar-controller');
const remoteCalendarController = require('./remote-calendar-controller');
const syncController = require('./sync-controller');

router.get('/calendars', calendarController.listCalendars);
router.get('/calendars/:id', calendarController.getCalendar);
router.post('/calendars', calendarController.createCalendar);
router.put('/calendars/:id', calendarController.updateCalendar);
router.delete('/calendars/:id', calendarController.deleteCalendar);

router.get('/remote-calendars', remoteCalendarController.listRemoteCalendars);
router.get('/remote-calendars/:id', remoteCalendarController.getRemoteCalendar);
router.post('/remote-calendars', remoteCalendarController.createRemoteCalendar);
router.put(
    '/remote-calendars/:id',
    remoteCalendarController.updateRemoteCalendar
);
router.delete(
    '/remote-calendars/:id',
    remoteCalendarController.deleteRemoteCalendar
);
router.post(
    '/remote-calendars/test-connection',
    remoteCalendarController.testConnection
);

router.post('/sync/calendars/:id', syncController.syncCalendar);
router.post('/sync/all', syncController.syncAllCalendars);
router.get('/sync/status/:id', syncController.getSyncStatus);
router.get('/sync/scheduler/status', syncController.getSchedulerStatus);

router.get('/conflicts', syncController.listConflicts);
router.get('/conflicts/:taskId', syncController.getConflict);
router.post('/conflicts/:taskId/resolve', syncController.resolveConflict);

module.exports = router;
