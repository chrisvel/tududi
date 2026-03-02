'use strict';

const matricesService = require('./service');
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
 * Matrices controller - handles HTTP requests/responses.
 */
const matricesController = {
    /**
     * GET /api/matrices
     * List all matrices for the current user.
     */
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.getAll(userId, req.query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/matrices/:matrixId
     * Get a single matrix with tasks by quadrant.
     */
    async getOne(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.getById(
                req.params.matrixId,
                userId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/matrices
     * Create a new matrix.
     */
    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.create(userId, req.body);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /api/matrices/:matrixId
     * Update a matrix.
     */
    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.update(
                req.params.matrixId,
                userId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/matrices/:matrixId
     * Delete a matrix.
     */
    async delete(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.delete(
                req.params.matrixId,
                userId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /api/matrices/:matrixId/tasks/:taskId
     * Assign or move a task in a matrix.
     */
    async assignTask(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.assignTask(
                req.params.matrixId,
                req.params.taskId,
                userId,
                req.body
            );
            res.status(result.created ? 201 : 200).json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/matrices/:matrixId/tasks/:taskId
     * Remove a task from a matrix.
     */
    async removeTask(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.removeTask(
                req.params.matrixId,
                req.params.taskId,
                userId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
    /**
     * GET /api/tasks/:taskId/matrices
     * Get all matrix placements for a specific task.
     */
    async getTaskMatrices(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.getTaskMatrices(
                req.params.taskId,
                userId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/matrices/:matrixId/browse
     * Browse available tasks filtered by source category.
     */
    async browseTasks(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.browseAvailableTasks(
                req.params.matrixId,
                userId,
                req.query.source,
                req.query.sourceId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/matrices/placements
     * Get all task-to-matrix placements for the authenticated user.
     */
    async allPlacements(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await matricesService.getAllPlacements(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = matricesController;
