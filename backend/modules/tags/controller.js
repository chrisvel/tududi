'use strict';

const tagsService = require('./service');

/**
 * Tags controller - handles HTTP requests/responses.
 * Business logic is delegated to the service layer.
 */
const tagsController = {
    /**
     * GET /api/tags
     * List all tags for the current user.
     */
    async list(req, res, next) {
        try {
            const tags = await tagsService.getAllForUser(req.currentUser.id);
            res.json(tags);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/tag?uid=xxx or ?name=xxx
     * Get a single tag by uid or name.
     */
    async getOne(req, res, next) {
        try {
            const { uid, name } = req.query;
            const tag = await tagsService.getByQuery(req.currentUser.id, {
                uid,
                name,
            });
            res.json(tag);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/tag
     * Create a new tag.
     */
    async create(req, res, next) {
        try {
            const { name } = req.body;
            const tag = await tagsService.create(req.currentUser.id, name);
            res.status(201).json(tag);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /api/tag/:identifier
     * Update a tag's name.
     */
    async update(req, res, next) {
        try {
            const { identifier } = req.params;
            const { name } = req.body;
            const tag = await tagsService.update(
                req.currentUser.id,
                identifier,
                name
            );
            res.json(tag);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/tag/:identifier
     * Delete a tag.
     */
    async delete(req, res, next) {
        try {
            const { identifier } = req.params;
            const result = await tagsService.delete(
                req.currentUser.id,
                identifier
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = tagsController;
