const express = require('express');
const { Notification } = require('../models');
const { logError } = require('../services/logService');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');

// Middleware to require authentication
router.use((req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
});

// GET /notifications - Get user's notifications
router.get('/', async (req, res) => {
    try {
        const {
            limit = 10,
            offset = 0,
            includeRead = 'true',
            type,
        } = req.query;

        const { notifications, total } =
            await Notification.getUserNotifications(req.authUserId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                includeRead: includeRead === 'true',
                type: type || null,
            });

        res.json({
            notifications,
            total,
        });
    } catch (error) {
        logError('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET /notifications/unread-count - Get count of unread notifications
router.get('/unread-count', async (req, res) => {
    try {
        const count = await Notification.getUnreadCount(req.authUserId);
        res.json({ count });
    } catch (error) {
        logError('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// POST /notifications/:id/read - Mark notification as read
router.post('/:id/read', async (req, res) => {
    try {
        const notification = await Notification.findOne({
            where: {
                id: req.params.id,
                user_id: req.authUserId,
            },
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await notification.markAsRead();

        res.json({
            notification,
            message: 'Notification marked as read',
        });
    } catch (error) {
        logError('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// POST /notifications/:id/unread - Mark notification as unread
router.post('/:id/unread', async (req, res) => {
    try {
        const notification = await Notification.findOne({
            where: {
                id: req.params.id,
                user_id: req.authUserId,
            },
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await notification.markAsUnread();

        res.json({
            notification,
            message: 'Notification marked as unread',
        });
    } catch (error) {
        logError('Error marking notification as unread:', error);
        res.status(500).json({
            error: 'Failed to mark notification as unread',
        });
    }
});

// POST /notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
    try {
        const [count] = await Notification.markAllAsRead(req.authUserId);

        res.json({
            count,
            message: `Marked ${count} notifications as read`,
        });
    } catch (error) {
        logError('Error marking all notifications as read:', error);
        res.status(500).json({
            error: 'Failed to mark all notifications as read',
        });
    }
});

// DELETE /notifications/:id - Soft delete (dismiss) a notification
router.delete('/:id', async (req, res) => {
    try {
        console.log(
            `Attempting to dismiss notification ${req.params.id} for user ${req.authUserId}`
        );

        const notification = await Notification.findOne({
            where: {
                id: req.params.id,
                user_id: req.authUserId,
                dismissed_at: null, // Only allow dismissing non-dismissed notifications
            },
        });

        if (!notification) {
            console.log(
                `Notification ${req.params.id} not found or already dismissed for user ${req.authUserId}`
            );
            return res.status(404).json({ error: 'Notification not found' });
        }

        await notification.dismiss();
        console.log(`Successfully dismissed notification ${req.params.id}`);

        res.json({ message: 'Notification dismissed successfully' });
    } catch (error) {
        logError('Error dismissing notification:', error);
        res.status(500).json({ error: 'Failed to dismiss notification' });
    }
});

module.exports = router;
