const express = require('express');
const router = express.Router();
const { Notification, User } = require('../models');
const { getAuthenticatedUserId } = require('../utils/request-utils');
const { v4: uuid } = require('uuid');

const NOTIFICATION_TEMPLATES = {
    task_due_soon: {
        title: 'Task Due Soon',
        message: 'Your test task "Complete project documentation" is due in 2 hours',
        level: 'warning',
        data: {
            taskUid: uuid(),
            taskName: 'Complete project documentation',
            dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            isOverdue: false,
        },
    },
    task_overdue: {
        title: 'Task Overdue',
        message: 'Your test task "Review pull request #123" is 3 days overdue',
        level: 'error',
        data: {
            taskUid: uuid(),
            taskName: 'Review pull request #123',
            dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            isOverdue: true,
        },
    },
    project_due_soon: {
        title: 'Project Due Soon',
        message: 'Your test project "Q4 Planning" is due in 6 hours',
        level: 'warning',
        data: {
            projectUid: uuid(),
            projectName: 'Q4 Planning',
            dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            isOverdue: false,
        },
    },
    project_overdue: {
        title: 'Project Overdue',
        message: 'Your test project "Website Redesign" is 1 day overdue',
        level: 'error',
        data: {
            projectUid: uuid(),
            projectName: 'Website Redesign',
            dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            isOverdue: true,
        },
    },
    defer_until: {
        title: 'Task Now Active',
        message: 'Your test task "Follow up with client" is now available to work on',
        level: 'info',
        data: {
            taskUid: uuid(),
            taskName: 'Follow up with client',
            deferUntil: new Date().toISOString(),
            reason: 'defer_until_reached',
        },
    },
};

function getSources(user, notificationType) {
    const sources = [];

    // Check notification preferences
    const prefs = user.notification_preferences;
    if (!prefs) return sources;

    // Map notification type to preference key
    const typeMapping = {
        task_due_soon: 'dueTasks',
        task_overdue: 'overdueTasks',
        project_due_soon: 'dueProjects',
        project_overdue: 'overdueProjects',
        defer_until: 'deferUntil',
    };

    const prefKey = typeMapping[notificationType];
    if (!prefKey || !prefs[prefKey]) return sources;

    // Add telegram to sources if enabled
    if (prefs[prefKey].telegram === true) {
        sources.push('telegram');
    }

    // Add email to sources if enabled
    if (prefs[prefKey].email === true) {
        sources.push('email');
    }

    return sources;
}

/**
 * POST /api/test-notifications/trigger
 * Trigger a test notification for the authenticated user
 */
router.post('/trigger', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const { type } = req.body;

        if (!type) {
            return res.status(400).json({
                error: 'Notification type is required',
                availableTypes: Object.keys(NOTIFICATION_TEMPLATES),
            });
        }

        const template = NOTIFICATION_TEMPLATES[type];
        if (!template) {
            return res.status(400).json({
                error: 'Invalid notification type',
                availableTypes: Object.keys(NOTIFICATION_TEMPLATES),
            });
        }

        // Fetch user with notification preferences
        const user = await User.findByPk(userId, {
            attributes: ['id', 'name', 'surname', 'notification_preferences', 'telegram_bot_token', 'telegram_chat_id'],
        });

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
            });
        }

        // Get sources based on user preferences
        const sources = getSources(user, type);

        // Create the test notification
        const notification = await Notification.createNotification({
            userId: userId,
            type: type,
            title: template.title,
            message: template.message,
            level: template.level,
            data: template.data,
            sources: sources,
            sentAt: new Date(),
        });

        res.json({
            success: true,
            notification: {
                id: notification.id,
                type: type,
                title: template.title,
                message: template.message,
                sources: sources,
            },
        });
    } catch (error) {
        console.error('Error triggering test notification:', error);
        res.status(500).json({
            error: 'Failed to trigger test notification',
            message: error.message,
        });
    }
});

/**
 * GET /api/test-notifications/types
 * Get available notification types for testing
 */
router.get('/types', async (req, res) => {
    try {
        const types = Object.keys(NOTIFICATION_TEMPLATES).map((key) => ({
            type: key,
            title: NOTIFICATION_TEMPLATES[key].title,
            level: NOTIFICATION_TEMPLATES[key].level,
        }));

        res.json({ types });
    } catch (error) {
        console.error('Error fetching notification types:', error);
        res.status(500).json({
            error: 'Failed to fetch notification types',
        });
    }
});

module.exports = router;
