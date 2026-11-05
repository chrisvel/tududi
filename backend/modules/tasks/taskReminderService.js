'use strict';

const { Op } = require('sequelize');
const { Task, User, Notification } = require('../../models');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
    reminderSources,
} = require('../../utils/notificationPreferences');

// Sends each task reminder once, at or after its reminder_at time.
async function checkTaskReminders(now = new Date()) {
    const tasks = await Task.findAll({
        where: {
            reminder_at: { [Op.not]: null, [Op.lte]: now },
            reminder_sent_at: null,
            status: {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    Task.STATUS.CANCELLED,
                ],
            },
        },
        include: [
            {
                model: User,
                attributes: [
                    'id',
                    'notification_preferences',
                    'telegram_bot_token',
                    'telegram_chat_id',
                ],
            },
        ],
    });

    let sent = 0;
    for (const task of tasks) {
        try {
            const user = task.User;
            if (!user) continue;

            // Mark first so a failing notification is not retried every minute.
            await task.update({ reminder_sent_at: now });

            if (!shouldSendInAppNotification(user, 'task_reminder')) continue;

            const telegram =
                !!(user.telegram_bot_token && user.telegram_chat_id) &&
                shouldSendTelegramNotification(user, 'task_reminder');

            await Notification.createNotification({
                userId: user.id,
                type: 'reminder',
                title: 'Task reminder',
                message: `Reminder: "${task.name}"`,
                sources: [
                    ...(telegram ? ['telegram'] : []),
                    ...reminderSources(user, 'task_reminder'),
                ],
                data: {
                    taskUid: task.uid,
                    taskName: task.name,
                    reason: 'task_reminder',
                },
                sentAt: now,
            });
            sent++;
        } catch (error) {
            logError(`Error sending reminder for task ${task.id}:`, error);
        }
    }

    return { remindersSent: sent };
}

module.exports = { checkTaskReminders };
