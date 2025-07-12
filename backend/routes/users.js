const express = require('express');
const { User } = require('../models');
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

// GET /api/profile
router.get('/profile', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findByPk(req.session.userId, {
            attributes: [
                'id',
                'email',
                'appearance',
                'language',
                'timezone',
                'avatar_image',
                'telegram_bot_token',
                'telegram_chat_id',
                'task_summary_enabled',
                'task_summary_frequency',
                'task_intelligence_enabled',
                'auto_suggest_next_actions_enabled',
                'pomodoro_enabled',
                'today_settings',
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
                console.error('Error parsing today_settings:', error);
                user.today_settings = null;
            }
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/profile
router.patch('/profile', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'Profile not found.' });
        }

        const {
            appearance,
            language,
            timezone,
            avatar_image,
            telegram_bot_token,
            task_intelligence_enabled,
            task_summary_enabled,
            task_summary_frequency,
            auto_suggest_next_actions_enabled,
            pomodoro_enabled,
            currentPassword,
            newPassword,
        } = req.body;

        const allowedUpdates = {};
        if (appearance !== undefined) allowedUpdates.appearance = appearance;
        if (language !== undefined) allowedUpdates.language = language;
        if (timezone !== undefined) allowedUpdates.timezone = timezone;
        if (avatar_image !== undefined)
            allowedUpdates.avatar_image = avatar_image;
        if (telegram_bot_token !== undefined)
            allowedUpdates.telegram_bot_token = telegram_bot_token;
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
        if (pomodoro_enabled !== undefined)
            allowedUpdates.pomodoro_enabled = pomodoro_enabled;

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
                'id',
                'email',
                'appearance',
                'language',
                'timezone',
                'avatar_image',
                'telegram_bot_token',
                'telegram_chat_id',
                'task_intelligence_enabled',
                'task_summary_enabled',
                'task_summary_frequency',
                'auto_suggest_next_actions_enabled',
                'pomodoro_enabled',
            ],
        });

        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating profile:', error);
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
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/profile/task-summary/toggle
router.post('/profile/task-summary/toggle', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
        console.error('Error toggling task summary:', error);
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
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
        console.error('Error updating task summary frequency:', error);
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
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
        console.error('Error sending task summary:', error);
        res.status(400).json({
            error: 'Error sending message to Telegram.',
            details: error.message,
        });
    }
});

// GET /api/profile/task-summary/status
router.get('/profile/task-summary/status', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
        console.error('Error fetching task summary status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/profile/today-settings
router.put('/profile/today-settings', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const {
            showMetrics,
            showProductivity,
            showIntelligence,
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
            showIntelligence:
                showIntelligence !== undefined
                    ? showIntelligence
                    : user.today_settings?.showIntelligence || false,
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

        await user.update({ today_settings: todaySettings });

        res.json({
            success: true,
            today_settings: todaySettings,
        });
    } catch (error) {
        console.error('Error updating today settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
