const { Task, Notification, User } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const {
    shouldSendInAppNotification,
} = require('../utils/notificationPreferences');

/**
 * Service to check for deferred tasks that are now active
 * and create notifications for users
 */

/**
 * Check for tasks that have a defer_until date that has passed
 * and create notifications for the task owners
 */
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
                // Check if user wants defer until notifications
                if (!shouldSendInAppNotification(task.User, 'deferUntil')) {
                    continue;
                }

                // Check for existing notifications (including dismissed ones)
                // If a notification was dismissed, don't create it again
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
                    // Skip if notification exists, even if it was dismissed
                    // This prevents re-notifying users about tasks they've already dismissed
                    continue;
                }

                await Notification.createNotification({
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

/**
 * Get statistics about deferred tasks
 */
async function getDeferredTaskStats() {
    try {
        const now = new Date();

        const [totalDeferred, activeNow, activeSoon] = await Promise.all([
            // Total tasks with defer_until set
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

            // Tasks that should be active now
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

            // Tasks that will be active in the next hour
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
