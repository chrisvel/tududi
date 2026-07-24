const { Task, Notification, User } = require('../../models');
const { Op } = require('sequelize');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');
const telegramPoller = require('../telegram/telegramPoller');

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
                        'telegram_bot_token',
                        'telegram_chat_id',
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

        // Batch-fetch all relevant notifications in one query to avoid N+1
        const userIds = [...new Set(deferredTasks.map((t) => t.user_id))];
        const allRecentNotifications = await Notification.findAll({
            where: {
                user_id: { [Op.in]: userIds },
                type: 'task_due_soon',
                created_at: { [Op.gte]: oneDayAgo },
            },
        });
        const notificationsByUser = {};
        for (const notif of allRecentNotifications) {
            if (!notificationsByUser[notif.user_id]) {
                notificationsByUser[notif.user_id] = [];
            }
            notificationsByUser[notif.user_id].push(notif);
        }

        // Group tasks by user
        const tasksByUser = {};
        for (const task of deferredTasks) {
            if (!tasksByUser[task.user_id]) {
                tasksByUser[task.user_id] = { user: task.User, tasks: [] };
            }
            tasksByUser[task.user_id].tasks.push(task);
        }

        for (const [userId, { user, tasks }] of Object.entries(tasksByUser)) {
            const wantsTelegram =
                user.telegram_bot_token &&
                user.telegram_chat_id &&
                shouldSendTelegramNotification(user, 'deferUntil');

            const activatedForTelegram = [];

            for (const task of tasks) {
                try {
                    if (!shouldSendInAppNotification(user, 'deferUntil')) {
                        continue;
                    }

                    const recentNotifications =
                        notificationsByUser[task.user_id] || [];

                    const existingNotification = recentNotifications.find(
                        (notif) =>
                            notif.data?.taskUid === task.uid &&
                            notif.data?.reason === 'defer_until_reached'
                    );

                    let preservedChannelSentAt = null;
                    let alreadySentViaTelegram = false;

                    if (existingNotification) {
                        if (existingNotification.dismissed_at) {
                            continue;
                        }

                        if (!existingNotification.read_at) {
                            preservedChannelSentAt =
                                existingNotification.channel_sent_at;
                            alreadySentViaTelegram =
                                existingNotification.wasChannelRecentlySent(
                                    'telegram',
                                    24 * 60 * 60 * 1000
                                );
                            await existingNotification.destroy();
                        } else {
                            continue;
                        }
                    }

                    const notification = await Notification.createNotification({
                        userId: task.user_id,
                        type: 'task_due_soon',
                        title: 'Task is now active',
                        message: `Your task "${task.name}" is now available to work on`,
                        sources: [],
                        data: {
                            taskUid: task.uid,
                            taskName: task.name,
                            deferUntil: task.defer_until,
                            reason: 'defer_until_reached',
                        },
                        sentAt: new Date(),
                        channel_sent_at: preservedChannelSentAt,
                    });

                    notificationsCreated++;

                    if (wantsTelegram && !alreadySentViaTelegram) {
                        activatedForTelegram.push({ task, notification });
                    }
                } catch (error) {
                    logError(
                        `Error creating notification for task ${task.id}:`,
                        error
                    );
                }
            }

            if (wantsTelegram && activatedForTelegram.length > 0) {
                await sendBatchedDeferredTelegramMessage(
                    user,
                    activatedForTelegram
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

async function sendBatchedDeferredTelegramMessage(user, items) {
    try {
        const lines = ['✅ Tasks Now Active:'];
        for (const { task } of items) {
            lines.push(`• ${task.name}`);
        }

        const message = lines.join('\n');
        await telegramPoller.sendTelegramMessage(
            user.telegram_bot_token,
            user.telegram_chat_id,
            message
        );

        for (const { notification } of items) {
            await notification.markChannelAsSent('telegram');
        }
    } catch (error) {
        logError(
            'Error sending batched Telegram deferred task message:',
            error
        );
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
