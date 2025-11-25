const { Project, Notification, User } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const {
    shouldSendInAppNotification,
} = require('../utils/notificationPreferences');

/**
 * Service to check for due and overdue projects
 * and create notifications for users
 */

/**
 * Check for projects that are due soon or overdue
 * and create notifications for the project owners
 */
async function checkDueProjects() {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const dueProjects = await Project.findAll({
            where: {
                due_date_at: {
                    [Op.not]: null,
                    [Op.lte]: tomorrow,
                },
                state: {
                    [Op.notIn]: ['completed'],
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

        if (dueProjects.length === 0) {
            return {
                success: true,
                projectsProcessed: 0,
                notificationsCreated: 0,
            };
        }

        let notificationsCreated = 0;

        for (const project of dueProjects) {
            try {
                const dueDate = new Date(project.due_date_at);
                const isOverdue = dueDate < now;
                const notificationType = isOverdue
                    ? 'project_overdue'
                    : 'project_due_soon';
                const level = isOverdue ? 'error' : 'warning';

                // Check if user wants this notification
                if (
                    !shouldSendInAppNotification(project.User, notificationType)
                ) {
                    continue;
                }

                // Check for existing notifications (including dismissed ones)
                // If a notification was dismissed, don't create it again
                const recentNotifications = await Notification.findAll({
                    where: {
                        user_id: project.user_id,
                        type: {
                            [Op.in]: ['project_due_soon', 'project_overdue'],
                        },
                        created_at: {
                            [Op.gte]: twoDaysAgo,
                        },
                    },
                });

                const existingNotification = recentNotifications.find(
                    (notif) =>
                        notif.data?.projectUid === project.uid &&
                        notif.type === notificationType
                );

                if (existingNotification) {
                    // Skip if notification exists, even if it was dismissed
                    // This prevents re-notifying users about tasks they've already dismissed
                    continue;
                }

                const { title, message } = generateNotificationContent(
                    project.name,
                    dueDate,
                    now,
                    isOverdue
                );

                await Notification.createNotification({
                    userId: project.user_id,
                    type: notificationType,
                    title,
                    message,
                    level,
                    sources: [],
                    data: {
                        projectUid: project.uid,
                        projectName: project.name,
                        dueDate: project.due_date_at,
                        isOverdue,
                    },
                    sentAt: new Date(),
                });

                notificationsCreated++;
            } catch (error) {
                logError(
                    `Error creating notification for project ${project.id}:`,
                    error
                );
            }
        }

        return {
            success: true,
            projectsProcessed: dueProjects.length,
            notificationsCreated,
        };
    } catch (error) {
        logError('Error checking due projects:', error);
        throw error;
    }
}

/**
 * Generate notification title and message based on project due date
 */
function generateNotificationContent(projectName, dueDate, now, isOverdue) {
    if (isOverdue) {
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        const title = 'Project is overdue';
        let message;

        if (daysOverdue === 0) {
            message = `Your project "${projectName}" was due today`;
        } else if (daysOverdue === 1) {
            message = `Your project "${projectName}" was due yesterday`;
        } else {
            message = `Your project "${projectName}" was due ${daysOverdue} days ago`;
        }

        return { title, message };
    } else {
        const hoursUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60));
        const title = 'Project due soon';
        let message;

        if (hoursUntilDue < 1) {
            message = `Your project "${projectName}" is due in less than 1 hour`;
        } else if (hoursUntilDue < 24) {
            message = `Your project "${projectName}" is due in ${hoursUntilDue} hours`;
        } else {
            message = `Your project "${projectName}" is due tomorrow`;
        }

        return { title, message };
    }
}

module.exports = {
    checkDueProjects,
};
