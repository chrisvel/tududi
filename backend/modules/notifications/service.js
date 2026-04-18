'use strict';

const notificationsRepository = require('./repository');
const { NotFoundError } = require('../../shared/errors');

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

    async triggerTestNotification(userId, testType) {
        const { User, Notification } = require('../../models');
        const {
            shouldSendTelegramNotification,
        } = require('../../utils/notificationPreferences');

        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'name',
                'notification_preferences',
                'telegram_bot_token',
                'telegram_chat_id',
            ],
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const typeMapping = {
            task_due_soon: {
                backendType: 'task_due_soon',
                preferenceKey: 'dueTasks',
                title: 'Test: Task Due Soon',
                message:
                    'This is a test notification for tasks that are due within 24 hours',
                data: { test: true, taskName: 'Sample Task' },
            },
            task_overdue: {
                backendType: 'task_overdue',
                preferenceKey: 'overdueTasks',
                title: 'Test: Task Overdue',
                message: 'This is a test notification for overdue tasks',
                data: { test: true, taskName: 'Sample Overdue Task' },
            },
            defer_until: {
                backendType: 'task_due_soon',
                preferenceKey: 'deferUntil',
                title: 'Test: Task Now Active',
                message:
                    'This is a test notification for tasks that are now available to work on',
                data: {
                    test: true,
                    taskName: 'Sample Deferred Task',
                    reason: 'defer_until_reached',
                },
            },
            project_due_soon: {
                backendType: 'project_due_soon',
                preferenceKey: 'dueProjects',
                title: 'Test: Project Due Soon',
                message:
                    'This is a test notification for projects that are due within 24 hours',
                data: { test: true, projectName: 'Sample Project' },
            },
            project_overdue: {
                backendType: 'project_overdue',
                preferenceKey: 'overdueProjects',
                title: 'Test: Project Overdue',
                message: 'This is a test notification for overdue projects',
                data: { test: true, projectName: 'Sample Overdue Project' },
            },
        };

        const config = typeMapping[testType];
        if (!config) {
            throw new Error(`Invalid test type: ${testType}`);
        }

        const sources = [];
        if (shouldSendTelegramNotification(user, config.preferenceKey)) {
            sources.push('telegram');
        }

        const notification = await Notification.createNotification({
            userId: user.id,
            type: config.backendType,
            title: config.title,
            message: config.message,
            data: config.data,
            sources,
            sentAt: new Date(),
        });

        return {
            notification: {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                sources: notification.sources,
            },
            message: 'Test notification created successfully',
        };
    }
}

module.exports = new NotificationsService();
