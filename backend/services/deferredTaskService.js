const { Task, Notification, User } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../utils/notificationPreferences');

async function checkDeferredTasks() {
    try {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        const deferredTasks = await Task.findAll({
            where: {
                defer_until: {
                    [Op.not]: null,
                    [Op.lte]: fiveMinutesFromNow,
                },
                status: {
                    [Op.ne]: 2,
                },
            },
            include: [
                {
                    model: User,
                    attributes: [
                        'id',
                        'email',
                        'name',
                        'notification_preferences',
                    ],
                },
            ],
        });

        if (deferredTasks.length === 0) {
            return {
                success: true,
                tasksProcessed: 0,
                notificationsCreated: 0,
            };
        }

        let notificationsCreated = 0;
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        for (const task of deferredTasks) {
            try {
                if (!shouldSendInAppNotification(task.User, 'deferUntil')) {
                    continue;
                }

                const recentNotifications = await Notification.findAll({
                    where: {
                        user_id: task.user_id,
                        type: 'task_due_soon',
                        created_at: {
                            [Op.gte]: oneDayAgo,
                        },
                    },
                });

                const existingNotification = recentNotifications.find(
                    (notif) =>
                        notif.data?.taskUid === task.uid &&
                        notif.data?.reason === 'defer_until_reached'
                );

                if (existingNotification) {
                    continue;
                }

                const sources = [];
                if (shouldSendTelegramNotification(task.User, 'deferUntil')) {
                    sources.push('telegram');
                }

                await Notification.createNotification({
                    userId: task.user_id,
                    type: 'task_due_soon',
                    title: 'Task is now active',
                    message: `Your task "${task.name}" is now available to work on`,
                    sources,
                    data: {
                        taskUid: task.uid,
                        taskName: task.name,
                        deferUntil: task.defer_until,
                        reason: 'defer_until_reached',
                    },
                    sentAt: new Date(),
                });

                notificationsCreated++;
            } catch (error) {
                logError(
                    `Error creating notification for task ${task.id}:`,
                    error
                );
            }
        }

        return {
            success: true,
            tasksProcessed: deferredTasks.length,
            notificationsCreated,
        };
    } catch (error) {
        logError('Error checking deferred tasks:', error);
        throw error;
    }
}

async function getDeferredTaskStats() {
    try {
        const now = new Date();

        const [totalDeferred, activeNow, activeSoon] = await Promise.all([
            Task.count({
                where: {
                    defer_until: {
                        [Op.not]: null,
                    },
                    status: {
                        [Op.ne]: 2, // Not completed
                    },
                },
            }),

            Task.count({
                where: {
                    defer_until: {
                        [Op.not]: null,
                        [Op.lte]: now,
                    },
                    status: {
                        [Op.ne]: 2, // Not completed
                    },
                },
            }),

            Task.count({
                where: {
                    defer_until: {
                        [Op.not]: null,
                        [Op.gt]: now,
                        [Op.lte]: new Date(now.getTime() + 60 * 60 * 1000),
                    },
                    status: {
                        [Op.ne]: 2, // Not completed
                    },
                },
            }),
        ]);

        return {
            totalDeferred,
            activeNow,
            activeSoon,
        };
    } catch (error) {
        logError('Error getting deferred task stats:', error);
        throw error;
    }
}

module.exports = {
    checkDeferredTasks,
    getDeferredTaskStats,
};
