const { Task, Notification, User } = require('../../models');
const { Op } = require('sequelize');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');

/**
 * Service to check for due and overdue tasks
 * and create notifications for users
 */

/**
 * Check for tasks that are due soon or overdue
 * and create notifications for the task owners
 */
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

        let notificationsCreated = 0;

        for (const task of dueTasks) {
            try {
                const dueDate = new Date(task.due_date);
                const isOverdue = dueDate < now;
                const notificationType = isOverdue
                    ? 'task_overdue'
                    : 'task_due_soon';
                const level = isOverdue ? 'error' : 'warning';
                const sendInApp = shouldSendInAppNotification(
                    task.User,
                    notificationType
                );
                const sendTelegram = shouldSendTelegramNotification(
                    task.User,
                    notificationType
                );

                if (!sendInApp && !sendTelegram) {
                    continue;
                }

                // Deduplication applies to all channel combinations.
                // Dismissed records act as rate-limiting anchors for Telegram-only sends.
                const recentNotifications = await Notification.findAll({
                    where: {
                        user_id: task.user_id,
                        type: {
                            [Op.in]: ['task_due_soon', 'task_overdue'],
                        },
                        created_at: {
                            [Op.gte]: twoDaysAgo,
                        },
                    },
                });

                const existingNotification = recentNotifications.find(
                    (notif) =>
                        notif.data?.taskUid === task.uid &&
                        notif.type === notificationType
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

                const { title, message } = generateNotificationContent(
                    task.name,
                    dueDate,
                    now,
                    isOverdue
                );

                const sources = sendTelegram ? ['telegram'] : [];

                const notification = await Notification.createNotification({
                    userId: task.user_id,
                    type: notificationType,
                    title,
                    message,
                    level,
                    sources,
                    data: {
                        taskUid: task.uid,
                        taskName: task.name,
                        dueDate: task.due_date,
                        isOverdue,
                    },
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
            tasksProcessed: dueTasks.length,
            notificationsCreated,
        };
    } catch (error) {
        logError('Error checking due tasks:', error);
        throw error;
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
