const express = require('express');
const router = express.Router();
const calendarController = require('./calendar-controller');
const remoteCalendarController = require('./remote-calendar-controller');
const syncController = require('./sync-controller');
const asyncHandler = require('../../../shared/middleware/asyncHandler');

router.get('/calendars', asyncHandler(calendarController.listCalendars));
router.get('/calendars/:id', asyncHandler(calendarController.getCalendar));
router.post('/calendars', asyncHandler(calendarController.createCalendar));
router.put('/calendars/:id', asyncHandler(calendarController.updateCalendar));
router.delete(
    '/calendars/:id',
    asyncHandler(calendarController.deleteCalendar)
);

router.get(
    '/remote-calendars',
    asyncHandler(remoteCalendarController.listRemoteCalendars)
);
router.get(
    '/remote-calendars/:id',
    asyncHandler(remoteCalendarController.getRemoteCalendar)
);
router.post(
    '/remote-calendars',
    asyncHandler(remoteCalendarController.createRemoteCalendar)
);
router.put(
    '/remote-calendars/:id',
    asyncHandler(remoteCalendarController.updateRemoteCalendar)
);
router.delete(
    '/remote-calendars/:id',
    asyncHandler(remoteCalendarController.deleteRemoteCalendar)
);
router.post(
    '/remote-calendars/test-connection',
    asyncHandler(remoteCalendarController.testConnection)
);

router.post('/sync/calendars/:id', asyncHandler(syncController.syncCalendar));
router.post('/sync/all', asyncHandler(syncController.syncAllCalendars));
router.get('/sync/status/:id', asyncHandler(syncController.getSyncStatus));
router.get(
    '/sync/scheduler/status',
    asyncHandler(syncController.getSchedulerStatus)
);

router.get('/conflicts', asyncHandler(syncController.listConflicts));
router.get('/conflicts/:taskId', asyncHandler(syncController.getConflict));
router.post(
    '/conflicts/:taskId/resolve',
    asyncHandler(syncController.resolveConflict)
);

module.exports = router;
