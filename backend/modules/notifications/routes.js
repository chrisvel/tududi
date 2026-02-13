'use strict';

const express = require('express');
const router = express.Router();
const notificationsController = require('./controller');

router.get('/notifications', notificationsController.getAll);
router.get(
    '/notifications/unread-count',
    notificationsController.getUnreadCount
);
router.post('/notifications/:id/read', notificationsController.markAsRead);
router.post('/notifications/:id/unread', notificationsController.markAsUnread);
router.post(
    '/notifications/mark-all-read',
    notificationsController.markAllAsRead
);
router.delete('/notifications/:id', notificationsController.dismiss);
router.get(
    '/notifications/push/vapid-key',
    notificationsController.getVapidKey
);
router.post('/notifications/push/subscribe', notificationsController.subscribe);
router.delete(
    '/notifications/push/unsubscribe',
    notificationsController.unsubscribe
);
router.post('/notifications/test/trigger', notificationsController.triggerTest);
router.get('/notifications/test/types', notificationsController.getTestTypes);

module.exports = router;
