'use strict';

const usersService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { logError } = require('../../services/logService');
const fs = require('fs').promises;

/**
 * Get authenticated user ID or throw UnauthorizedError.
 */
function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        throw new UnauthorizedError('Authentication required');
    }
    return userId;
}

/**
 * Users controller - handles HTTP requests/responses.
 */
const usersController = {
    /**
     * GET /api/users
     * List all users.
     */
    async list(req, res, next) {
        try {
            const users = await usersService.listUsers();
            res.json(users);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/profile
     * Get current user profile.
     */
    async getProfile(req, res, next) {
        try {
            const userId = requireUserId(req);
            const profile = await usersService.getProfile(userId);
            res.json(profile);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /api/profile
     * Update current user profile.
     */
    async updateProfile(req, res, next) {
        try {
            const userId = requireUserId(req);
            const profile = await usersService.updateProfile(userId, req.body);
            res.json(profile);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/profile/avatar
     * Upload avatar.
     */
    async uploadAvatar(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.uploadAvatar(userId, req.file);
            res.json(result);
        } catch (error) {
            if (req.file) {
                await fs.unlink(req.file.path).catch(() => {});
            }
            next(error);
        }
    },

    /**
     * DELETE /api/profile/avatar
     * Delete avatar.
     */
    async deleteAvatar(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.deleteAvatar(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/profile/change-password
     * Change password.
     */
    async changePassword(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { currentPassword, newPassword } = req.body;
            const result = await usersService.changePassword(
                userId,
                currentPassword,
                newPassword
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/profile/api-keys
     * List API keys.
     */
    async listApiKeys(req, res, next) {
        try {
            const userId = requireUserId(req);
            const keys = await usersService.listApiKeys(userId);
            res.json(keys);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/profile/api-keys
     * Create API key.
     */
    async createApiKey(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { name, expires_at } = req.body || {};
            const result = await usersService.createApiKey(
                userId,
                name,
                expires_at
            );
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/profile/api-keys/:id/revoke
     * Revoke API key.
     */
    async revokeApiKey(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.revokeApiKey(
                userId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/profile/api-keys/:id
     * Delete API key.
     */
    async deleteApiKey(req, res, next) {
        try {
            const userId = requireUserId(req);
            await usersService.deleteApiKey(userId, req.params.id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/profile/task-summary/toggle
     * Toggle task summary.
     */
    async toggleTaskSummary(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.toggleTaskSummary(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/profile/task-summary/frequency
     * Update task summary frequency.
     */
    async updateTaskSummaryFrequency(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { frequency } = req.body;
            const result = await usersService.updateTaskSummaryFrequency(
                userId,
                frequency
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/profile/task-summary/send-now
     * Send task summary now.
     */
    async sendTaskSummaryNow(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.sendTaskSummaryNow(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/profile/task-summary/status
     * Get task summary status.
     */
    async getTaskSummaryStatus(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.getTaskSummaryStatus(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /api/profile/today-settings
     * Update today settings.
     */
    async updateTodaySettings(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.updateTodaySettings(
                userId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /api/profile/sidebar-settings
     * Update sidebar settings.
     */
    async updateSidebarSettings(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.updateSidebarSettings(
                userId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /api/profile/ui-settings
     * Update UI settings.
     */
    async updateUiSettings(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await usersService.updateUiSettings(
                userId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = usersController;
