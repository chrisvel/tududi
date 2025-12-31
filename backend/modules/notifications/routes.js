'use strict';

const express = require('express');
const router = express.Router();
const notificationsController = require('./controller');

router.get('/notifications', notificationsController.getAll);
router.get('/notifications/unread-count', notificationsController.getUnreadCount);
router.post('/notifications/:id/read', notificationsController.markAsRead);
router.post('/notifications/:id/unread', notificationsController.markAsUnread);
router.post('/notifications/mark-all-read', notificationsController.markAllAsRead);
router.delete('/notifications/:id', notificationsController.dismiss);

module.exports = router;
