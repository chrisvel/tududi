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
                        const validSources = ['telegram', 'mobile', 'email'];
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

    // Define associations
    Notification.associate = function (models) {
        // Notification belongs to User
        Notification.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    /**
     * Create a notification and send it via configured sources
     */
    Notification.createNotification = async function ({
        userId,
        type,
        title,
        message,
        data = null,
        sources = [],
        sentAt = null,
        level = 'info',
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
        });

        if (sources.includes('email')) {
            await sendEmailNotification(userId, title, message, Notification);
        }

        return notification;
    };

    /**
     * Send email notification
     */
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

    /**
     * Mark a notification as unread
     */
    Notification.prototype.markAsUnread = async function () {
        this.read_at = null;
        await this.save();
        return this;
    };

    /**
     * Check if notification is read
     */
    Notification.prototype.isRead = function () {
        return this.read_at !== null;
    };

    /**
     * Dismiss (soft delete) a notification
     */
    Notification.prototype.dismiss = async function () {
        if (!this.dismissed_at) {
            this.dismissed_at = new Date();
            await this.save();
        }
        return this;
    };

    /**
     * Check if notification is dismissed
     */
    Notification.prototype.isDismissed = function () {
        return this.dismissed_at !== null;
    };

    /**
     * Get notifications for a user with pagination
     */
    Notification.getUserNotifications = async function (userId, options = {}) {
        const {
            limit = 10,
            offset = 0,
            includeRead = true,
            type = null,
        } = options;

        const where = {
            user_id: userId,
            dismissed_at: null, // Exclude dismissed notifications
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

    /**
     * Get count of unread notifications for a user
     */
    Notification.getUnreadCount = async function (userId) {
        return await Notification.count({
            where: {
                user_id: userId,
                read_at: null,
                dismissed_at: null, // Exclude dismissed notifications
            },
        });
    };

    /**
     * Mark all notifications as read for a user
     */
    Notification.markAllAsRead = async function (userId) {
        return await Notification.update(
            { read_at: new Date() },
            {
                where: {
                    user_id: userId,
                    read_at: null,
                    dismissed_at: null, // Only mark non-dismissed notifications as read
                },
            }
        );
    };

    return Notification;
};
