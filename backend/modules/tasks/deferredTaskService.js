const { Task, Notification, User } = require('../../models');
const { Op } = require('sequelize');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');

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
                const sendInApp = shouldSendInAppNotification(
                    task.User,
                    'deferUntil'
                );
                const sendTelegram = shouldSendTelegramNotification(
                    task.User,
                    'deferUntil'
                );

                if (!sendInApp && !sendTelegram) {
                    continue;
                }

                const title = 'Task is now active';
                const message = `Your task "${task.name}" is now available to work on`;
                const data = {
                    taskUid: task.uid,
                    taskName: task.name,
                    deferUntil: task.defer_until,
                    reason: 'defer_until_reached',
                };

                // Deduplication applies to all channel combinations.
                // Dismissed records act as rate-limiting anchors for Telegram-only sends.
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

                let preservedChannelSentAt = null;

                if (existingNotification) {
                    if (existingNotification.dismissed_at) {
                        continue;
                    }
                    if (!existingNotification.read_at) {
                        preservedChannelSentAt =
                            existingNotification.channel_sent_at;
                        await existingNotification.destroy();
                    } else {
                        continue;
                    }
                }

                const sources = sendTelegram ? ['telegram'] : [];

                const notification = await Notification.createNotification({
                    userId: task.user_id,
                    type: 'task_due_soon',
                    title,
                    message,
                    sources,
                    data,
                    sentAt: new Date(),
                    channel_sent_at: preservedChannelSentAt,
                });

                // Telegram-only: dismiss immediately so the record does not appear
                // in the bell or increment the badge, but still serves as a
                // deduplication anchor and Telegram rate-limiting record.
                if (!sendInApp) {
                    await notification.dismiss();
                }

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
