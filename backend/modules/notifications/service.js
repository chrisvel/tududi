'use strict';

const notificationsRepository = require('./repository');
const {
    NotFoundError,
    ValidationError,
    AppError,
} = require('../../shared/errors');
const webPushService = require('../../services/webPushService');
const { Notification, User } = require('../../models');
const { v4: uuid } = require('uuid');

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

    async getVapidKey() {
        const publicKey = webPushService.getVapidPublicKey();
        if (!publicKey) {
            throw new AppError(
                'Push notifications not configured',
                503,
                'SERVICE_UNAVAILABLE'
            );
        }
        return { publicKey };
    }

    async subscribe(userId, subscription) {
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            throw new ValidationError('Invalid subscription object');
        }

        const result = await webPushService.subscribe(userId, subscription);
        if (!result.success) {
            throw new Error(result.error || 'Failed to subscribe');
        }

        return { success: true, created: result.created };
    }

    async unsubscribe(userId, endpoint) {
        if (!endpoint) {
            throw new ValidationError('Endpoint is required');
        }

        const result = await webPushService.unsubscribe(userId, endpoint);
        return { success: true, deleted: result.deleted };
    }

    async triggerTest(userId, type) {
        const templates = this.getNotificationTemplates();
        const availableTypes = Object.keys(templates);

        if (!type) {
            const error = new ValidationError('Notification type is required');
            error.availableTypes = availableTypes;
            throw error;
        }

        const template = templates[type];
        if (!template) {
            const error = new ValidationError('Invalid notification type');
            error.availableTypes = availableTypes;
            throw error;
        }

        // Fetch user with notification preferences
        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'name',
                'surname',
                'notification_preferences',
                'telegram_bot_token',
                'telegram_chat_id',
            ],
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Get sources based on user preferences
        const sources = this.getSources(user, type);

        // Create the test notification
        const notification = await Notification.createNotification({
            userId: userId,
            type: type,
            title: template.title,
            message: template.message,
            level: template.level,
            data: template.data,
            sources: sources,
            sentAt: new Date(),
        });

        return {
            success: true,
            notification: {
                id: notification.id,
                type: type,
                title: template.title,
                message: template.message,
                sources: sources,
            },
        };
    }

    async getTestTypes() {
        const templates = this.getNotificationTemplates();
        const types = Object.keys(templates).map((key) => ({
            type: key,
            title: templates[key].title,
            level: templates[key].level,
        }));

        return { types };
    }

    getNotificationTemplates() {
        return {
            task_due_soon: {
                title: 'Task Due Soon',
                message:
                    'Your test task "Complete project documentation" is due in 2 hours',
                level: 'warning',
                data: {
                    taskUid: uuid(),
                    taskName: 'Complete project documentation',
                    dueDate: new Date(
                        Date.now() + 2 * 60 * 60 * 1000
                    ).toISOString(),
                    isOverdue: false,
                },
            },
            task_overdue: {
                title: 'Task Overdue',
                message:
                    'Your test task "Review pull request #123" is 3 days overdue',
                level: 'error',
                data: {
                    taskUid: uuid(),
                    taskName: 'Review pull request #123',
                    dueDate: new Date(
                        Date.now() - 3 * 24 * 60 * 60 * 1000
                    ).toISOString(),
                    isOverdue: true,
                },
            },
            project_due_soon: {
                title: 'Project Due Soon',
                message: 'Your test project "Q4 Planning" is due in 6 hours',
                level: 'warning',
                data: {
                    projectUid: uuid(),
                    projectName: 'Q4 Planning',
                    dueDate: new Date(
                        Date.now() + 6 * 60 * 60 * 1000
                    ).toISOString(),
                    isOverdue: false,
                },
            },
            project_overdue: {
                title: 'Project Overdue',
                message:
                    'Your test project "Website Redesign" is 1 day overdue',
                level: 'error',
                data: {
                    projectUid: uuid(),
                    projectName: 'Website Redesign',
                    dueDate: new Date(
                        Date.now() - 1 * 24 * 60 * 60 * 1000
                    ).toISOString(),
                    isOverdue: true,
                },
            },
            defer_until: {
                title: 'Task Now Active',
                message:
                    'Your test task "Follow up with client" is now available to work on',
                level: 'info',
                data: {
                    taskUid: uuid(),
                    taskName: 'Follow up with client',
                    deferUntil: new Date().toISOString(),
                    reason: 'defer_until_reached',
                },
            },
        };
    }

    getSources(user, notificationType) {
        const sources = [];

        // Check notification preferences
        const prefs = user.notification_preferences;
        if (!prefs) return sources;

        // Map notification type to preference key
        const typeMapping = {
            task_due_soon: 'dueTasks',
            task_overdue: 'overdueTasks',
            project_due_soon: 'dueProjects',
            project_overdue: 'overdueProjects',
            defer_until: 'deferUntil',
        };

        const prefKey = typeMapping[notificationType];
        if (!prefKey || !prefs[prefKey]) return sources;

        // Add telegram to sources if enabled
        if (prefs[prefKey].telegram === true) {
            sources.push('telegram');
        }

        // Add email to sources if enabled
        if (prefs[prefKey].email === true) {
            sources.push('email');
        }

        // Add push to sources if enabled
        if (prefs[prefKey].push === true) {
            sources.push('push');
        }

        return sources;
    }
}

module.exports = new NotificationsService();
