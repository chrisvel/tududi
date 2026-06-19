'use strict';

const areasService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

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
 * Areas controller - handles HTTP requests/responses.
 */
const areasController = {
    /**
     * GET /api/areas
     * List all areas for the current user.
     */
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const areas = await areasService.getAll(userId);
            res.json(areas);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/areas/:uid
     * Get a single area by UID.
     */
    async getOne(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const area = await areasService.getByUid(userId, uid);
            res.json(area);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/areas
     * Create a new area.
     */
    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { name, description, color } = req.body;
            const area = await areasService.create(userId, {
                name,
                description,
                color,
            });
            res.status(201).json(area);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /api/areas/:uid
     * Update an area.
     */
    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const { name, description, color } = req.body;
            const area = await areasService.update(userId, uid, {
                name,
                description,
                color,
            });
            res.json(area);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/areas/:uid
     * Delete an area.
     */
    async delete(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            await areasService.delete(userId, uid);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },
};

module.exports = areasController;
