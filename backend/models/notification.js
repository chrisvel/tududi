const { DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
    const Notification = sequelize.define(
        'Notification',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: false,
                defaultValue: () => uuid(),
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isIn: [
                        [
                            'task_assigned',
                            'task_completed',
                            'task_due_soon',
                            'task_overdue',
                            'comment_added',
                            'mention',
                            'reminder',
                            'system',
                            'project_due_soon',
                            'project_overdue',
                        ],
                    ],
                },
            },
            level: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'info',
                validate: {
                    isIn: [['info', 'warning', 'error', 'success']],
                },
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            data: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            sources: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: [],
                validate: {
                    isValidSources(value) {
                        if (!Array.isArray(value)) {
                            throw new Error('Sources must be an array');
                        }
                        const validSources = [
                            'telegram',
                            'mobile',
                            'email',
                            'push',
                        ];
                        const invalidSources = value.filter(
                            (s) => !validSources.includes(s)
                        );
                        if (invalidSources.length > 0) {
                            throw new Error(
                                `Invalid sources: ${invalidSources.join(', ')}`
                            );
                        }
                    },
                },
            },
            read_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            sent_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            dismissed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            channel_sent_at: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null,
            },
        },
        {
            tableName: 'notifications',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['read_at'],
                },
                {
                    fields: ['created_at'],
                },
                {
                    fields: ['user_id', 'read_at'],
                },
                {
                    fields: ['dismissed_at'],
                },
                {
                    fields: ['user_id', 'dismissed_at'],
                },
            ],
        }
    );

    Notification.associate = function (models) {
        Notification.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    Notification.createNotification = async function ({
        userId,
        type,
        title,
        message,
        data = null,
        sources = [],
        sentAt = null,
        level = 'info',
        channel_sent_at = null,
    }) {
        const notification = await Notification.create({
            user_id: userId,
            type,
            title,
            message,
            data,
            sources,
            level,
            sent_at: sentAt || new Date(),
            channel_sent_at,
        });

        if (sources.includes('email')) {
            await sendEmailNotification(userId, title, message, Notification);
        }

        if (sources.includes('telegram')) {
            await sendTelegramNotification(
                userId,
                title,
                message,
                data,
                Notification,
                notification
            );
        }

        if (sources.includes('push')) {
            await sendWebPushNotification(userId, {
                title,
                message,
                data,
                type,
            });
        }

        return notification;
    };

    async function sendWebPushNotification(userId, notification) {
        try {
            const webPushService = require('../services/webPushService');
            if (webPushService.isWebPushConfigured()) {
                await webPushService.sendPushNotification(userId, notification);
            }
        } catch (error) {
            console.error('Failed to send Web Push notification:', error);
        }
    }

    async function sendEmailNotification(
        userId,
        title,
        message,
        NotificationModel
    ) {
        try {
            const {
                sendEmail,
                isEmailEnabled,
            } = require('../services/emailService');

            if (!isEmailEnabled() || !message) {
                return;
            }

            const UserModel = NotificationModel.sequelize.models.User;
            const user = await UserModel.findByPk(userId, {
                attributes: ['email', 'name'],
            });

            if (user?.email) {
                await sendEmail({
                    to: user.email,
                    subject: title,
                    text: message,
                });
            }
        } catch (error) {
            console.error('Failed to send email notification:', error);
        }
    }

    async function sendTelegramNotification(
        userId,
        title,
        message,
        data,
        NotificationModel,
        notificationInstance
    ) {
        try {
            const telegramService = require('../modules/telegram/telegramNotificationService');

            if (!message) {
                return;
            }

            // Check if Telegram was recently sent for this notification (within 24 hours)
            // to prevent spam from delete-and-recreate pattern
            if (
                notificationInstance &&
                notificationInstance.wasChannelRecentlySent(
                    'telegram',
                    24 * 60 * 60 * 1000
                )
            ) {
                return; // Skip sending to prevent spam
            }

            const UserModel = NotificationModel.sequelize.models.User;
            const user = await UserModel.findByPk(userId, {
                attributes: [
                    'id',
                    'name',
                    'surname',
                    'telegram_bot_token',
                    'telegram_chat_id',
                ],
            });

            if (user && telegramService.isTelegramConfigured(user)) {
                await telegramService.sendTelegramNotification(user, {
                    title,
                    message,
                    data,
                    level: 'info',
                });

                // Mark that Telegram was sent for this notification
                if (notificationInstance) {
                    await notificationInstance.markChannelAsSent('telegram');
                }
            }
        } catch (error) {
            console.error('Failed to send Telegram notification:', error);
        }
    }

    /**
     * Mark a notification as read
     */
    Notification.prototype.markAsRead = async function () {
        if (!this.read_at) {
            this.read_at = new Date();
            await this.save();
        }
        return this;
    };

    Notification.prototype.markAsUnread = async function () {
        this.read_at = null;
        await this.save();
        return this;
    };

    Notification.prototype.isRead = function () {
        return this.read_at !== null;
    };

    Notification.prototype.dismiss = async function () {
        if (!this.dismissed_at) {
            this.dismissed_at = new Date();
            await this.save();
        }
        return this;
    };

    Notification.prototype.isDismissed = function () {
        return this.dismissed_at !== null;
    };

    /**
     * Mark a notification channel as sent
     * @param {string} channel - The channel name (telegram, email, push)
     */
    Notification.prototype.markChannelAsSent = async function (channel) {
        const sentTimes = this.channel_sent_at || {};
        sentTimes[channel] = new Date().toISOString();
        this.channel_sent_at = sentTimes;
        await this.save();
        return this;
    };

    /**
     * Check if a channel was recently sent for this notification
     * @param {string} channel - The channel name (telegram, email, push)
     * @param {number} thresholdMs - Time threshold in milliseconds (default: 24 hours)
     * @returns {boolean} True if channel was sent within threshold
     */
    Notification.prototype.wasChannelRecentlySent = function (
        channel,
        thresholdMs = 24 * 60 * 60 * 1000
    ) {
        if (!this.channel_sent_at || !this.channel_sent_at[channel]) {
            return false;
        }
        const lastSent = new Date(this.channel_sent_at[channel]);
        const now = new Date();
        return now - lastSent < thresholdMs;
    };

    Notification.getUserNotifications = async function (userId, options = {}) {
        const {
            limit = 10,
            offset = 0,
            includeRead = true,
            type = null,
        } = options;

        const where = {
            user_id: userId,
            dismissed_at: null,
        };
        if (!includeRead) {
            where.read_at = null;
        }
        if (type) {
            where.type = type;
        }

        const result = await Notification.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        return {
            notifications: result.rows,
            total: result.count,
        };
    };

    Notification.getUnreadCount = async function (userId) {
        return await Notification.count({
            where: {
                user_id: userId,
                read_at: null,
                dismissed_at: null,
            },
        });
    };

    Notification.markAllAsRead = async function (userId) {
        return await Notification.update(
            { read_at: new Date() },
            {
                where: {
                    user_id: userId,
                    read_at: null,
                    dismissed_at: null,
                },
            }
        );
    };

    return Notification;
};
