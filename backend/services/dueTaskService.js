const { Task, Notification, User } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const {
    shouldSendInAppNotification,
} = require('../utils/notificationPreferences');

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

                // Check if user wants this notification
                if (!shouldSendInAppNotification(task.User, notificationType)) {
                    continue;
                }

                // Check for existing notifications (including dismissed ones)
                // If a notification was dismissed, don't create it again
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

                if (existingNotification) {
                    // Skip if notification exists, even if it was dismissed
                    // This prevents re-notifying users about tasks they've already dismissed
                    continue;
                }

                const { title, message } = generateNotificationContent(
                    task.name,
                    dueDate,
                    now,
                    isOverdue
                );

                await Notification.createNotification({
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
            tasksProcessed: dueTasks.length,
            notificationsCreated,
        };
    } catch (error) {
        logError('Error checking due tasks:', error);
        throw error;
    }
}

/**
 * Generate notification title and message based on task due date
 */
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
