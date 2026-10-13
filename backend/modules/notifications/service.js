'use strict';

const notificationsRepository = require('./repository');
const { NotFoundError, ValidationError } = require('../../shared/errors');

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

    async markAsRead(userId, notificationUid) {
        const notification = await notificationsRepository.findByUidAndUser(
            notificationUid,
            userId
        );
        if (!notification) {
            throw new NotFoundError('Notification not found');
        }
        await notification.markAsRead();
        return { notification, message: 'Notification marked as read' };
    }

    async markAsUnread(userId, notificationUid) {
        const notification = await notificationsRepository.findByUidAndUser(
            notificationUid,
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

    async dismiss(userId, notificationUid) {
        const notification = await notificationsRepository.findByUidAndUser(
            notificationUid,
            userId,
            { dismissed_at: null }
        );
        if (!notification) {
            throw new NotFoundError('Notification not found');
        }
        await notification.dismiss();
        return { message: 'Notification dismissed successfully' };
    }

    // Sends one test through a single channel, so each column of the
    // Notifications tab can be checked on its own.
    async triggerTestNotification(userId, channel) {
        const { User, Notification } = require('../../models');

        if (channel === 'inApp') {
            await Notification.createNotification({
                userId,
                type: 'system',
                title: 'Test notification',
                message: 'In-app notifications are working.',
                sources: [],
            });
            return { channel, delivered: true };
        }

        if (channel === 'push') {
            const pushService = require('../push/service');
            const sent = await pushService.sendToUser(userId, {
                title: 'Test notification',
                body: 'Push notifications are working on this device.',
                url: '/',
                tag: 'test',
            });
            if (sent === 0) {
                throw new ValidationError(
                    'No device received it. Turn on push for this device first.'
                );
            }
            return { channel, delivered: true, devices: sent };
        }

        if (channel === 'telegram') {
            const telegramService = require('../telegram/telegramNotificationService');
            const user = await User.findByPk(userId, {
                attributes: [
                    'id',
                    'name',
                    'surname',
                    'telegram_bot_token',
                    'telegram_chat_id',
                ],
            });
            if (!user) throw new NotFoundError('User not found');
            const result = await telegramService.sendTelegramNotification(
                user,
                {
                    title: 'Test notification',
                    message: 'Telegram notifications are working.',
                    level: 'info',
                }
            );
            if (!result.success) {
                throw new ValidationError(
                    result.error || 'Could not send the Telegram message'
                );
            }
            return { channel, delivered: true };
        }

        if (channel === 'email') {
            throw new ValidationError(
                'Email notifications are not available yet'
            );
        }

        throw new ValidationError(`Invalid channel: ${channel}`);
    }
}

module.exports = new NotificationsService();
