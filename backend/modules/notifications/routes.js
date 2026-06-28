'use strict';

const express = require('express');
const router = express.Router();
const notificationsController = require('./controller');

router.get('/notifications', notificationsController.getAll);
router.get(
    '/notifications/unread-count',
    notificationsController.getUnreadCount
);
router.post('/notifications/:uid/read', notificationsController.markAsRead);
router.post('/notifications/:uid/unread', notificationsController.markAsUnread);
router.post(
    '/notifications/mark-all-read',
    notificationsController.markAllAsRead
);
router.delete('/notifications/:uid', notificationsController.dismiss);
router.post(
    '/test-notifications/trigger',
    notificationsController.triggerTestNotification
);

module.exports = router;
