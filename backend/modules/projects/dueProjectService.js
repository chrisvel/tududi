const { Project, Notification, User } = require('../../models');
const { Op } = require('sequelize');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');
const telegramPoller = require('../telegram/telegramPoller');

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
                status: {
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
                        'telegram_bot_token',
                        'telegram_chat_id',
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

        // Batch-fetch all relevant notifications in one query to avoid N+1
        const userIds = [...new Set(dueProjects.map((p) => p.user_id))];
        const allRecentNotifications = await Notification.findAll({
            where: {
                user_id: { [Op.in]: userIds },
                type: { [Op.in]: ['project_due_soon', 'project_overdue'] },
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

        // Group projects by user
        const projectsByUser = {};
        for (const project of dueProjects) {
            if (!projectsByUser[project.user_id]) {
                projectsByUser[project.user_id] = {
                    user: project.User,
                    projects: [],
                };
            }
            projectsByUser[project.user_id].projects.push(project);
        }

        let notificationsCreated = 0;

        for (const [userId, { user, projects }] of Object.entries(
            projectsByUser
        )) {
            const wantsTelegram =
                user.telegram_bot_token &&
                user.telegram_chat_id &&
                (shouldSendTelegramNotification(user, 'project_due_soon') ||
                    shouldSendTelegramNotification(user, 'project_overdue'));

            const dueSoonForTelegram = [];
            const overdueForTelegram = [];

            for (const project of projects) {
                try {
                    const dueDate = new Date(project.due_date_at);
                    const isOverdue = dueDate < now;
                    const notificationType = isOverdue
                        ? 'project_overdue'
                        : 'project_due_soon';
                    const level = isOverdue ? 'error' : 'warning';

                    if (!shouldSendInAppNotification(user, notificationType)) {
                        continue;
                    }

                    const recentNotifications =
                        notificationsByUser[project.user_id] || [];

                    const existingNotification = recentNotifications.find(
                        (notif) =>
                            notif.data?.projectUid === project.uid &&
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
                        project.name,
                        dueDate,
                        now,
                        isOverdue
                    );

                    const notification = await Notification.createNotification({
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
                        channel_sent_at: preservedChannelSentAt,
                    });

                    notificationsCreated++;

                    if (wantsTelegram && !alreadySentViaTelegram) {
                        if (isOverdue) {
                            overdueForTelegram.push({
                                project,
                                dueDate,
                                notification,
                            });
                        } else {
                            dueSoonForTelegram.push({ project, notification });
                        }
                    }
                } catch (error) {
                    logError(
                        `Error creating notification for project ${project.id}:`,
                        error
                    );
                }
            }

            if (wantsTelegram) {
                await sendBatchedProjectTelegramMessage(
                    user,
                    dueSoonForTelegram,
                    overdueForTelegram,
                    now
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

async function sendBatchedProjectTelegramMessage(
    user,
    dueSoonItems,
    overdueItems,
    now
) {
    try {
        const parts = [];

        if (overdueItems.length > 0) {
            parts.push('🔴 Overdue Projects:');
            for (const { project, dueDate } of overdueItems) {
                const daysOverdue = Math.floor(
                    (now - dueDate) / (1000 * 60 * 60 * 24)
                );
                const age =
                    daysOverdue === 0
                        ? 'due today'
                        : daysOverdue === 1
                          ? 'due yesterday'
                          : `due ${daysOverdue} days ago`;
                parts.push(`• ${project.name} (${age})`);
            }
        }

        if (dueSoonItems.length > 0) {
            if (parts.length > 0) parts.push('');
            parts.push('⚠️ Projects Due Soon:');
            for (const { project } of dueSoonItems) {
                parts.push(`• ${project.name}`);
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
        logError('Error sending batched Telegram project message:', error);
    }
}

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
