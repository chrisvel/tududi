'use strict';

const notificationsRepository = require('./repository');
const { Notification, User } = require('../../models');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');
const telegramNotificationService = require('../telegram/telegramNotificationService');

const TEST_NOTIFICATION_TYPES = new Set([
    'task_due_soon',
    'task_overdue',
    'defer_until',
    'project_due_soon',
    'project_overdue',
]);

const TEST_NOTIFICATION_CONTENT = {
    task_due_soon: {
        title: 'Test task due soon',
        message: 'This is a test notification for a task due soon',
        level: 'warning',
    },
    task_overdue: {
        title: 'Test task overdue',
        message: 'This is a test notification for an overdue task',
        level: 'error',
    },
    defer_until: {
        title: 'Test task now active',
        message: 'This is a test notification for a deferred task',
        level: 'info',
    },
    project_due_soon: {
        title: 'Test project due soon',
        message: 'This is a test notification for a project due soon',
        level: 'warning',
    },
    project_overdue: {
        title: 'Test project overdue',
        message: 'This is a test notification for an overdue project',
        level: 'error',
    },
};

function normalizePreferenceType(type) {
    return type === 'defer_until' ? 'deferUntil' : type;
}

function normalizeNotificationType(type) {
    return type === 'defer_until' ? 'task_due_soon' : type;
}

class NotificationsService {
    async getAll(userId, options) {
        const { limit = 10, offset = 0, includeRead = 'true', type } = options;
        return notificationsRepository.getUserNotifications(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            includeRead: includeRead === 'true',
            type: type || null,
        });
    }

    async getUnreadCount(userId) {
        const count = await notificationsRepository.getUnreadCount(userId);
        return { count };
    }

    async triggerTestNotification(userId, type = 'task_due_soon') {
        if (!TEST_NOTIFICATION_TYPES.has(type)) {
            throw new ValidationError('Invalid notification type');
        }

        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'notification_preferences',
                'telegram_bot_token',
                'telegram_chat_id',
            ],
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const preferenceType = normalizePreferenceType(type);
        const notificationType = normalizeNotificationType(type);
        const sendInApp = shouldSendInAppNotification(user, preferenceType);
        const sendTelegram =
            shouldSendTelegramNotification(user, preferenceType) &&
            telegramNotificationService.isTelegramConfigured(user);
        const { title, message, level } = TEST_NOTIFICATION_CONTENT[type];
        const data = {
            test: true,
            requestedType: type,
        };

        // Build explicit channel list for the response so the client always
        // knows exactly what was sent without inferring from sources.
        const channels = [];
        if (sendInApp) channels.push('inApp');
        if (sendTelegram) channels.push('telegram');

        if (channels.length === 0) {
            return {
                notification: {
                    type: notificationType,
                    title,
                    message,
                    level,
                    sources: [],
                },
                channels: [],
                message: 'No notification channels enabled',
            };
        }

        const sources = sendTelegram ? ['telegram'] : [];

        if (sendInApp) {
            const notification = await Notification.createNotification({
                userId,
                type: notificationType,
                title,
                message,
                level,
                sources,
                data,
                sentAt: new Date(),
            });

            return {
                notification,
                channels,
                message: 'Test notification sent',
            };
        }

        await Notification.sendTelegramNotification({
            userId,
            title,
            message,
            level,
            data,
        });

        return {
            notification: {
                type: notificationType,
                title,
                message,
                level,
                sources,
                data,
            },
            channels,
            message: 'Test notification sent',
        };
    }

    async markAsRead(userId, notificationId) {
        const notification = await notificationsRepository.findByIdAndUser(
            notificationId,
            userId
        );
        if (!notification) {
            throw new NotFoundError('Notification not found');
        }
        await notification.markAsRead();
        return { notification, message: 'Notification marked as read' };
    }

    async markAsUnread(userId, notificationId) {
        const notification = await notificationsRepository.findByIdAndUser(
            notificationId,
            userId
        );
        if (!notification) {
            throw new NotFoundError('Notification not found');
        }
        await notification.markAsUnread();
        return { notification, message: 'Notification marked as unread' };
    }

    async markAllAsRead(userId) {
        const [count] = await notificationsRepository.markAllAsRead(userId);
        return { count, message: `Marked ${count} notifications as read` };
    }

    async dismiss(userId, notificationId) {
        const notification = await notificationsRepository.findByIdAndUser(
            notificationId,
            userId,
            { dismissed_at: null }
        );
        if (!notification) {
            throw new NotFoundError('Notification not found');
        }
        await notification.dismiss();
        return { message: 'Notification dismissed successfully' };
    }
}

module.exports = new NotificationsService();
