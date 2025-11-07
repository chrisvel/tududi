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

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: string
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *                 surname:
 *                   type: string
 *                 appearance:
 *                   type: string
 *                   enum: [light, dark, system]
 *                 language:
 *                   type: string
 *                 timezone:
 *                   type: string
 *                 first_day_of_week:
 *                   type: integer
 *                 avatar_image:
 *                   type: string
 *                 telegram_bot_token:
 *                   type: string
 *                 telegram_chat_id:
 *                   type: string
 *                 task_summary_enabled:
 *                   type: boolean
 *                 task_summary_frequency:
 *                   type: string
 *                 task_intelligence_enabled:
 *                   type: boolean
 *                 pomodoro_enabled:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
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

/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's first name
 *               surname:
 *                 type: string
 *                 description: User's last name
 *               appearance:
 *                 type: string
 *                 enum: [light, dark, system]
 *                 description: Theme preference
 *               language:
 *                 type: string
 *                 description: Language code (e.g., "en", "es")
 *               timezone:
 *                 type: string
 *                 description: Timezone (e.g., "America/New_York")
 *               first_day_of_week:
 *                 type: integer
 *                 description: First day of week (0=Sunday, 1=Monday)
 *               avatar_image:
 *                 type: string
 *                 description: Avatar image URL
 *               telegram_bot_token:
 *                 type: string
 *                 description: Telegram bot token
 *               telegram_allowed_users:
 *                 type: string
 *                 description: Comma-separated list of allowed Telegram users
 *               task_intelligence_enabled:
 *                 type: boolean
 *                 description: Enable task intelligence features
 *               task_summary_enabled:
 *                 type: boolean
 *                 description: Enable task summary emails
 *               pomodoro_enabled:
 *                 type: boolean
 *                 description: Enable Pomodoro timer
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: string
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
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

/**
 * @swagger
 * /api/profile/api-keys:
 *   get:
 *     summary: List API keys for the current user
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApiKey'
 */
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

/**
 * @swagger
 * /api/profile/api-keys:
 *   post:
 *     summary: Create a new API key
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Friendly name for the API key
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration timestamp
 *     responses:
 *       201:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: The plain API key. This value is only returned once.
 *                 apiKey:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Invalid payload
 */
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

/**
 * @swagger
 * /api/profile/api-keys/{id}/revoke:
 *   post:
 *     summary: Revoke an API key
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Revoked key details
 *       404:
 *         description: API key not found
 */
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

/**
 * @swagger
 * /api/profile/api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: API key deleted
 *       404:
 *         description: API key not found
 */
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

// POST /api/profile/task-summary/toggle
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

// POST /api/profile/task-summary/send-now
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

// GET /api/profile/task-summary/status
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

// PUT /api/profile/today-settings
router.put('/profile/today-settings', async (req, res) => {
    try {
        const user = await User.findByPk(req.authUserId);
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

// PUT /api/profile/sidebar-settings
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

module.exports = router;
