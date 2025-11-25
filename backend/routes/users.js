const express = require('express');
const { User, Role, ApiToken } = require('../models');
const _ = require('lodash');
const { logError } = require('../services/logService');
const taskSummaryService = require('../services/taskSummaryService');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');
const {
    createApiToken,
    revokeApiToken,
    deleteApiToken,
    serializeApiToken,
} = require('../services/apiTokenService');
const { apiKeyManagementLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

router.use((req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
});

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

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/avatars');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.authUserId}-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: fileFilter,
});

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

router.get('/profile', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId, {
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
                'sidebar_settings',
                'productivity_assistant_enabled',
                'next_task_suggestion_enabled',
                'notification_preferences',
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
        if (user.ui_settings && typeof user.ui_settings === 'string') {
            try {
                user.ui_settings = JSON.parse(user.ui_settings);
            } catch (error) {
                logError('Error parsing ui_settings:', error);
                user.ui_settings = null;
            }
        }

        res.json(user);
    } catch (error) {
        logError('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/profile', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
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
            ui_settings,
            notification_preferences,
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
        if (ui_settings !== undefined) allowedUpdates.ui_settings = ui_settings;
        if (notification_preferences !== undefined)
            allowedUpdates.notification_preferences = notification_preferences;

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
                'notification_preferences',
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

router.post('/profile/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = await User.findByPk(req.authUserId);
        if (!user) {
            // Clean up uploaded file
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete old avatar file if it exists
        if (user.avatar_image) {
            const oldAvatarPath = path.join(
                __dirname,
                '../uploads/avatars',
                path.basename(user.avatar_image)
            );
            await fs.unlink(oldAvatarPath).catch(() => {
                // Ignore errors if file doesn't exist
            });
        }

        // Store relative path in database
        const avatarUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
        await user.update({ avatar_image: avatarUrl });

        res.json({
            success: true,
            avatar_image: avatarUrl,
            message: 'Avatar uploaded successfully',
        });
    } catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        logError('Error uploading avatar:', error);
        res.status(500).json({
            error: 'Failed to upload avatar',
            details: error.message,
        });
    }
});

router.delete('/profile/avatar', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete avatar file if it exists
        if (user.avatar_image) {
            const avatarPath = path.join(
                __dirname,
                '../uploads/avatars',
                path.basename(user.avatar_image)
            );
            await fs.unlink(avatarPath).catch(() => {
                // Ignore errors if file doesn't exist
            });
        }

        await user.update({ avatar_image: null });

        res.json({
            success: true,
            message: 'Avatar removed successfully',
        });
    } catch (error) {
        logError('Error removing avatar:', error);
        res.status(500).json({
            error: 'Failed to remove avatar',
            details: error.message,
        });
    }
});

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

        const user = await User.findByPk(req.authUserId);
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

router.get('/profile/api-keys', apiKeyManagementLimiter, async (req, res) => {
    try {
        const tokens = await ApiToken.findAll({
            where: { user_id: req.authUserId },
            order: [['created_at', 'DESC']],
        });

        res.json(tokens.map(serializeApiToken));
    } catch (error) {
        logError('Error listing API keys:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/profile/api-keys', apiKeyManagementLimiter, async (req, res) => {
    try {
        const { name, expires_at } = req.body || {};

        if (!name || _.isEmpty(name.trim())) {
            return res.status(400).json({ error: 'API key name is required.' });
        }

        let expiresAtDate = null;
        if (expires_at) {
            const parsedDate = new Date(expires_at);
            if (Number.isNaN(parsedDate.getTime())) {
                return res
                    .status(400)
                    .json({ error: 'expires_at must be a valid date.' });
            }
            expiresAtDate = parsedDate;
        }

        const { rawToken, tokenRecord } = await createApiToken({
            userId: req.authUserId,
            name: name.trim(),
            expiresAt: expiresAtDate,
        });

        res.status(201).json({
            token: rawToken,
            apiKey: serializeApiToken(tokenRecord),
        });
    } catch (error) {
        logError('Error creating API key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post(
    '/profile/api-keys/:id/revoke',
    apiKeyManagementLimiter,
    async (req, res) => {
        try {
            const tokenId = parseInt(req.params.id, 10);
            if (Number.isNaN(tokenId)) {
                return res.status(400).json({ error: 'Invalid API key id.' });
            }

            const token = await revokeApiToken(tokenId, req.authUserId);
            if (!token) {
                return res.status(404).json({ error: 'API key not found.' });
            }

            res.json(serializeApiToken(token));
        } catch (error) {
            logError('Error revoking API key:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.delete(
    '/profile/api-keys/:id',
    apiKeyManagementLimiter,
    async (req, res) => {
        try {
            const tokenId = parseInt(req.params.id, 10);
            if (Number.isNaN(tokenId)) {
                return res.status(400).json({ error: 'Invalid API key id.' });
            }

            const deleted = await deleteApiToken(tokenId, req.authUserId);
            if (!deleted) {
                return res.status(404).json({ error: 'API key not found.' });
            }

            res.status(204).send();
        } catch (error) {
            logError('Error deleting API key:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.post('/profile/task-summary/toggle', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
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

router.post('/profile/task-summary/frequency', async (req, res) => {
    try {
        const { frequency } = req.body;

        if (!frequency) {
            return res.status(400).json({ error: 'Frequency is required.' });
        }

        if (!VALID_FREQUENCIES.includes(frequency)) {
            return res.status(400).json({ error: 'Invalid frequency value.' });
        }

        const user = await User.findByPk(req.authUserId);
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

router.post('/profile/task-summary/send-now', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
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

router.get('/profile/task-summary/status', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
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

router.put('/profile/today-settings', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const {
            showMetrics,
            projectShowMetrics,
            showProductivity,
            showNextTaskSuggestion,
            showSuggestions,
            showDueToday,
            showCompleted,
            showProgressBar,
            showDailyQuote,
        } = req.body;

        const todaySettings = {
            projectShowMetrics:
                projectShowMetrics !== undefined
                    ? projectShowMetrics
                    : (user.today_settings?.projectShowMetrics ?? true),
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

router.put('/profile/sidebar-settings', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const { pinnedViewsOrder } = req.body;

        if (!Array.isArray(pinnedViewsOrder)) {
            return res.status(400).json({
                error: 'pinnedViewsOrder must be an array',
            });
        }

        const sidebarSettings = {
            pinnedViewsOrder,
        };

        await user.update({
            sidebar_settings: sidebarSettings,
        });

        res.json({
            success: true,
            sidebar_settings: sidebarSettings,
        });
    } catch (error) {
        logError('Error updating sidebar settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update generic UI settings (e.g., project metrics preferences)
router.put('/profile/ui-settings', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const { project } = req.body;

        const currentSettings = (user.ui_settings &&
        typeof user.ui_settings === 'object'
            ? user.ui_settings
            : {}) || { project: { details: {} } };

        const newSettings = {
            ...currentSettings,
            project: {
                ...(currentSettings.project || {}),
                ...(project || {}),
                details: {
                    ...((currentSettings.project &&
                        currentSettings.project.details) ||
                        {}),
                    ...((project && project.details) || {}),
                },
            },
        };

        await user.update({ ui_settings: newSettings });

        res.json({ success: true, ui_settings: newSettings });
    } catch (error) {
        logError('Error updating ui settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
