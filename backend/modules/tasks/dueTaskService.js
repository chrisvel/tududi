const { Task, Notification, User } = require('../../models');
const { Op } = require('sequelize');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');
const telegramPoller = require('../telegram/telegramPoller');

async function checkDueTasks() {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const dueTasks = await Task.findAll({
            where: {
                due_date: {
                    [Op.not]: null,
                    [Op.lte]: tomorrow,
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

        if (dueTasks.length === 0) {
            return {
                success: true,
                tasksProcessed: 0,
                notificationsCreated: 0,
            };
        }

        // Batch-fetch all relevant notifications in one query to avoid N+1
        const userIds = [...new Set(dueTasks.map((t) => t.user_id))];
        const allRecentNotifications = await Notification.findAll({
            where: {
                user_id: { [Op.in]: userIds },
                type: { [Op.in]: ['task_due_soon', 'task_overdue'] },
                created_at: { [Op.gte]: twoDaysAgo },
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
        for (const task of dueTasks) {
            if (!tasksByUser[task.user_id]) {
                tasksByUser[task.user_id] = { user: task.User, tasks: [] };
            }
            tasksByUser[task.user_id].tasks.push(task);
        }

        let notificationsCreated = 0;

        for (const [userId, { user, tasks }] of Object.entries(tasksByUser)) {
            const wantsTelegram =
                user.telegram_bot_token &&
                user.telegram_chat_id &&
                (shouldSendTelegramNotification(user, 'task_due_soon') ||
                    shouldSendTelegramNotification(user, 'task_overdue'));

            const dueSoonForTelegram = [];
            const overdueForTelegram = [];

            for (const task of tasks) {
                try {
                    const dueDate = new Date(task.due_date);
                    const isOverdue = dueDate < now;
                    const notificationType = isOverdue
                        ? 'task_overdue'
                        : 'task_due_soon';
                    const level = isOverdue ? 'error' : 'warning';

                    if (!shouldSendInAppNotification(user, notificationType)) {
                        continue;
                    }

                    const recentNotifications =
                        notificationsByUser[task.user_id] || [];

                    const existingNotification = recentNotifications.find(
                        (notif) =>
                            notif.data?.taskUid === task.uid &&
                            notif.type === notificationType
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

                    const { title, message } = generateNotificationContent(
                        task.name,
                        dueDate,
                        now,
                        isOverdue
                    );

                    const notification = await Notification.createNotification({
                        userId: task.user_id,
                        type: notificationType,
                        title,
                        message,
                        level,
                        sources: [],
                        data: {
                            taskUid: task.uid,
                            taskName: task.name,
                            dueDate: task.due_date,
                            isOverdue,
                        },
                        sentAt: new Date(),
                        channel_sent_at: preservedChannelSentAt,
                    });

                    notificationsCreated++;

                    if (wantsTelegram && !alreadySentViaTelegram) {
                        if (isOverdue) {
                            overdueForTelegram.push({
                                task,
                                dueDate,
                                notification,
                            });
                        } else {
                            dueSoonForTelegram.push({ task, notification });
                        }
                    }
                } catch (error) {
                    logError(
                        `Error creating notification for task ${task.id}:`,
                        error
                    );
                }
            }

            // Send one batched Telegram message per type per user
            if (wantsTelegram) {
                await sendBatchedTaskTelegramMessage(
                    user,
                    dueSoonForTelegram,
                    overdueForTelegram,
                    now
                );
            }
        }

        return {
            success: true,
            tasksProcessed: dueTasks.length,
            notificationsCreated,
        };
    } catch (error) {
        logError('Error checking due tasks:', error);
        throw error;
    }
}

async function sendBatchedTaskTelegramMessage(
    user,
    dueSoonItems,
    overdueItems,
    now
) {
    try {
        const parts = [];

        if (overdueItems.length > 0) {
            parts.push('🔴 Overdue Tasks:');
            for (const { task, dueDate } of overdueItems) {
                const daysOverdue = Math.floor(
                    (now - dueDate) / (1000 * 60 * 60 * 24)
                );
                const age =
                    daysOverdue === 0
                        ? 'due today'
                        : daysOverdue === 1
                          ? 'due yesterday'
                          : `due ${daysOverdue} days ago`;
                parts.push(`• ${task.name} (${age})`);
            }
        }

        if (dueSoonItems.length > 0) {
            if (parts.length > 0) parts.push('');
            parts.push('⚠️ Tasks Due Soon:');
            for (const { task } of dueSoonItems) {
                parts.push(`• ${task.name}`);
            }
        }

        if (parts.length === 0) return;

        const message = parts.join('\n');
        await telegramPoller.sendTelegramMessage(
            user.telegram_bot_token,
            user.telegram_chat_id,
            message
        );

        const allNotifications = [
            ...overdueItems.map((i) => i.notification),
            ...dueSoonItems.map((i) => i.notification),
        ];
        for (const notification of allNotifications) {
            await notification.markChannelAsSent('telegram');
        }
    } catch (error) {
        logError('Error sending batched Telegram task message:', error);
    }
}

function generateNotificationContent(taskName, dueDate, now, isOverdue) {
    if (isOverdue) {
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        const title = 'Task is overdue';
        let message;

        if (daysOverdue === 0) {
            message = `Your task "${taskName}" was due today`;
        } else if (daysOverdue === 1) {
            message = `Your task "${taskName}" was due yesterday`;
        } else {
            message = `Your task "${taskName}" was due ${daysOverdue} days ago`;
        }

        return { title, message };
    } else {
        const hoursUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60));
        const title = 'Task due soon';
        let message;

        if (hoursUntilDue < 1) {
            message = `Your task "${taskName}" is due in less than 1 hour`;
        } else if (hoursUntilDue < 24) {
            message = `Your task "${taskName}" is due in ${hoursUntilDue} hours`;
        } else {
            message = `Your task "${taskName}" is due tomorrow`;
        }

        return { title, message };
    }
}

module.exports = {
    checkDueTasks,
};
