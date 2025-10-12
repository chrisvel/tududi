const express = require('express');
const { User, Role } = require('../models');
const { logError } = require('../services/logService');
const taskSummaryService = require('../services/taskSummaryService');
const router = express.Router();

const VALID_FREQUENCIES = [
    'daily',
    'weekdays',
    'weekly',
    '1h',
    '2h',
    '4h',
    '8h',
    '12h',
];

// GET /api/users - list all users for sharing purposes
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email', 'name', 'surname'],
            order: [['email', 'ASC']],
        });

        // Fetch roles in bulk
        const roles = await Role.findAll({
            attributes: ['user_id', 'is_admin'],
        });
        const userIdToRole = new Map(roles.map((r) => [r.user_id, r.is_admin]));

        const result = users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            surname: u.surname,
            role: userIdToRole.get(u.id) ? 'admin' : 'user',
        }));

        res.json(result);
    } catch (err) {
        logError('Error listing users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId, {
            attributes: [
                'uid',
                'email',
                'name',
                'surname',
                'appearance',
                'language',
                'timezone',
                'first_day_of_week',
                'avatar_image',
                'telegram_bot_token',
                'telegram_chat_id',
                'telegram_allowed_users',
                'task_summary_enabled',
                'task_summary_frequency',
                'task_intelligence_enabled',
                'auto_suggest_next_actions_enabled',
                'pomodoro_enabled',
                'today_settings',
                'productivity_assistant_enabled',
                'next_task_suggestion_enabled',
            ],
        });

        if (!user) {
            return res.status(404).json({ error: 'Profile not found.' });
        }

        // Parse today_settings if it's a string
        if (user.today_settings && typeof user.today_settings === 'string') {
            try {
                user.today_settings = JSON.parse(user.today_settings);
            } catch (error) {
                logError('Error parsing today_settings:', error);
                user.today_settings = null;
            }
        }

        res.json(user);
    } catch (error) {
        logError('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/profile
router.patch('/profile', async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'Profile not found.' });
        }

        const {
            name,
            surname,
            appearance,
            language,
            timezone,
            first_day_of_week,
            avatar_image,
            telegram_bot_token,
            telegram_allowed_users,
            task_intelligence_enabled,
            task_summary_enabled,
            task_summary_frequency,
            auto_suggest_next_actions_enabled,
            productivity_assistant_enabled,
            next_task_suggestion_enabled,
            pomodoro_enabled,
            currentPassword,
            newPassword,
        } = req.body;

        const allowedUpdates = {};
        if (name !== undefined) allowedUpdates.name = name;
        if (surname !== undefined) allowedUpdates.surname = surname;
        if (appearance !== undefined) allowedUpdates.appearance = appearance;
        if (language !== undefined) allowedUpdates.language = language;
        if (timezone !== undefined) allowedUpdates.timezone = timezone;
        if (first_day_of_week !== undefined)
            allowedUpdates.first_day_of_week = first_day_of_week;
        if (avatar_image !== undefined)
            allowedUpdates.avatar_image = avatar_image;
        if (telegram_bot_token !== undefined)
            allowedUpdates.telegram_bot_token = telegram_bot_token;
        if (telegram_allowed_users !== undefined)
            allowedUpdates.telegram_allowed_users = telegram_allowed_users;
        if (task_intelligence_enabled !== undefined)
            allowedUpdates.task_intelligence_enabled =
                task_intelligence_enabled;
        if (task_summary_enabled !== undefined)
            allowedUpdates.task_summary_enabled = task_summary_enabled;
        if (task_summary_frequency !== undefined)
            allowedUpdates.task_summary_frequency = task_summary_frequency;
        if (auto_suggest_next_actions_enabled !== undefined)
            allowedUpdates.auto_suggest_next_actions_enabled =
                auto_suggest_next_actions_enabled;
        if (productivity_assistant_enabled !== undefined)
            allowedUpdates.productivity_assistant_enabled =
                productivity_assistant_enabled;
        if (next_task_suggestion_enabled !== undefined)
            allowedUpdates.next_task_suggestion_enabled =
                next_task_suggestion_enabled;
        if (pomodoro_enabled !== undefined)
            allowedUpdates.pomodoro_enabled = pomodoro_enabled;

        // Validate first_day_of_week if provided
        if (first_day_of_week !== undefined) {
            if (
                typeof first_day_of_week !== 'number' ||
                first_day_of_week < 0 ||
                first_day_of_week > 6
            ) {
                return res.status(400).json({
                    field: 'first_day_of_week',
                    error: 'First day of week must be a number between 0 (Sunday) and 6 (Saturday)',
                });
            }
        }

        // Handle password change if provided
        if (currentPassword && newPassword) {
            if (newPassword.length < 6) {
                return res.status(400).json({
                    field: 'newPassword',
                    error: 'Password must be at least 6 characters',
                });
            }

            // Verify current password
            const isValidPassword = await User.checkPassword(
                currentPassword,
                user.password_digest
            );
            if (!isValidPassword) {
                return res.status(400).json({
                    field: 'currentPassword',
                    error: 'Current password is incorrect',
                });
            }

            // Hash and include new password in updates
            const hashedNewPassword = await User.hashPassword(newPassword);
            allowedUpdates.password_digest = hashedNewPassword;
        }

        await user.update(allowedUpdates);

        // Return updated user with limited fields
        const updatedUser = await User.findByPk(user.id, {
            attributes: [
                'uid',
                'email',
                'name',
                'surname',
                'appearance',
                'language',
                'timezone',
                'avatar_image',
                'telegram_bot_token',
                'telegram_chat_id',
                'telegram_allowed_users',
                'task_intelligence_enabled',
                'task_summary_enabled',
                'task_summary_frequency',
                'auto_suggest_next_actions_enabled',
                'productivity_assistant_enabled',
                'next_task_suggestion_enabled',
                'pomodoro_enabled',
            ],
        });

        res.json(updatedUser);
    } catch (error) {
        logError('Error updating profile:', error);
        res.status(400).json({
            error: 'Failed to update profile.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// POST /api/profile/change-password
router.post('/profile/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Current password and new password are required',
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                field: 'newPassword',
                error: 'Password must be at least 6 characters',
            });
        }

        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isValidPassword = await User.checkPassword(
            currentPassword,
            user.password_digest
        );
        if (!isValidPassword) {
            return res.status(400).json({
                field: 'currentPassword',
                error: 'Current password is incorrect',
            });
        }

        // Hash and update new password
        const hashedNewPassword = await User.hashPassword(newPassword);
        await user.update({ password_digest: hashedNewPassword });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        logError('Error changing password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/profile/task-summary/toggle
router.post('/profile/task-summary/toggle', async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const enabled = !user.task_summary_enabled;

        await user.update({ task_summary_enabled: enabled });

        // Note: Telegram integration would need to be implemented separately
        const message = enabled
            ? 'Task summary notifications have been enabled.'
            : 'Task summary notifications have been disabled.';

        res.json({
            success: true,
            enabled: enabled,
            message: message,
        });
    } catch (error) {
        logError('Error toggling task summary:', error);
        res.status(400).json({
            error: 'Failed to update task summary settings.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// POST /api/profile/task-summary/frequency
router.post('/profile/task-summary/frequency', async (req, res) => {
    try {
        const { frequency } = req.body;

        if (!frequency) {
            return res.status(400).json({ error: 'Frequency is required.' });
        }

        if (!VALID_FREQUENCIES.includes(frequency)) {
            return res.status(400).json({ error: 'Invalid frequency value.' });
        }

        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        await user.update({ task_summary_frequency: frequency });

        res.json({
            success: true,
            frequency: frequency,
            message: `Task summary frequency has been set to ${frequency}.`,
        });
    } catch (error) {
        logError('Error updating task summary frequency:', error);
        res.status(400).json({
            error: 'Failed to update task summary frequency.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// POST /api/profile/task-summary/send-now
router.post('/profile/task-summary/send-now', async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!user.telegram_bot_token || !user.telegram_chat_id) {
            return res
                .status(400)
                .json({ error: 'Telegram bot is not properly configured.' });
        }

        // Send the task summary
        const success = await taskSummaryService.sendSummaryToUser(user.id);

        if (success) {
            res.json({
                success: true,
                message: 'Task summary was sent to your Telegram.',
            });
        } else {
            res.status(400).json({
                error: 'Failed to send message to Telegram.',
            });
        }
    } catch (error) {
        logError('Error sending task summary:', error);
        res.status(400).json({
            error: 'Error sending message to Telegram.',
            details: error.message,
        });
    }
});

// GET /api/profile/task-summary/status
router.get('/profile/task-summary/status', async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            success: true,
            enabled: user.task_summary_enabled,
            frequency: user.task_summary_frequency,
            last_run: user.task_summary_last_run,
            next_run: user.task_summary_next_run,
        });
    } catch (error) {
        logError('Error fetching task summary status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/profile/today-settings
router.put('/profile/today-settings', async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const {
            showMetrics,
            showProductivity,
            showNextTaskSuggestion,
            showSuggestions,
            showDueToday,
            showCompleted,
            showProgressBar,
            showDailyQuote,
        } = req.body;

        const todaySettings = {
            showMetrics:
                showMetrics !== undefined
                    ? showMetrics
                    : user.today_settings?.showMetrics || false,
            showProductivity:
                showProductivity !== undefined
                    ? showProductivity
                    : user.today_settings?.showProductivity || false,
            showNextTaskSuggestion:
                showNextTaskSuggestion !== undefined
                    ? showNextTaskSuggestion
                    : user.today_settings?.showNextTaskSuggestion || false,
            showSuggestions:
                showSuggestions !== undefined
                    ? showSuggestions
                    : user.today_settings?.showSuggestions || false,
            showDueToday:
                showDueToday !== undefined
                    ? showDueToday
                    : user.today_settings?.showDueToday || true,
            showCompleted:
                showCompleted !== undefined
                    ? showCompleted
                    : user.today_settings?.showCompleted || true,
            showProgressBar: true, // Always enabled - ignore any attempts to disable it
            showDailyQuote:
                showDailyQuote !== undefined
                    ? showDailyQuote
                    : user.today_settings?.showDailyQuote || true,
        };

        // Sync productivity features with today settings
        const profileUpdates = {};
        if (showProductivity !== undefined) {
            profileUpdates.productivity_assistant_enabled = showProductivity;
        }
        if (showNextTaskSuggestion !== undefined) {
            profileUpdates.next_task_suggestion_enabled =
                showNextTaskSuggestion;
        }

        await user.update({
            today_settings: todaySettings,
            ...profileUpdates,
        });

        res.json({
            success: true,
            today_settings: todaySettings,
        });
    } catch (error) {
        logError('Error updating today settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
