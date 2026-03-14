'use strict';

const projectsService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { extractUidFromSlug } = require('../../utils/slug-utils');
const { logError } = require('../../services/logService');

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
 * Projects controller - handles HTTP requests/responses.
 */
const projectsController = {
    /**
     * GET /api/projects
     * List all projects for the current user.
     */
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await projectsService.getAll(userId, req.query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/project/:uidSlug
     * Get a single project by UID.
     */
    async getOne(req, res, next) {
        try {
            const uid = extractUidFromSlug(req.params.uidSlug);
            const timezone = req.currentUser?.timezone;
            const project = await projectsService.getByUid(uid, timezone);
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/project
     * Create a new project.
     */
    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const project = await projectsService.create(userId, req.body);
            res.status(201).json(project);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /api/project/:uid
     * Update a project.
     */
    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const project = await projectsService.update(
                userId,
                req.params.uid,
                req.body
            );
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/project/:uid
     * Delete a project.
     */
    async delete(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await projectsService.delete(userId, req.params.uid);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/upload/project-image
     * Upload a project image.
     */
    async uploadImage(req, res, next) {
        try {
            if (!req.file) {
                return res
                    .status(400)
                    .json({ error: 'No image file provided' });
            }
            const imageUrl = `/api/uploads/projects/${req.file.filename}`;
            res.json({ imageUrl });
        } catch (error) {
            logError('Error uploading image:', error);
            res.status(500).json({ error: 'Failed to upload image' });
        }
    },

    /**
     * Get project UID if exists (for authorization middleware).
     */
    async getProjectUidForAuth(req) {
        const uid = extractUidFromSlug(req.params.uidSlug || req.params.uid);
        return projectsService.getProjectUidIfExists(uid);
    },
};

module.exports = projectsController;
