'use strict';

const inboxService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        throw new UnauthorizedError('Authentication required');
    }
    return userId;
}

const inboxController = {
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { limit, offset } = req.query;
            const result = await inboxService.getAll(userId, { limit, offset });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async getOne(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const item = await inboxService.getByUid(userId, uid);
            res.json(item);
        } catch (error) {
            next(error);
        }
    },

    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { content, source } = req.body;
            const item = await inboxService.create(userId, { content, source });
            res.status(201).json(item);
        } catch (error) {
            next(error);
        }
    },

    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const { content, status } = req.body;
            const item = await inboxService.update(userId, uid, {
                content,
                status,
            });
            res.json(item);
        } catch (error) {
            next(error);
        }
    },

    async delete(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const result = await inboxService.delete(userId, uid);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async process(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const item = await inboxService.process(userId, uid);
            res.json(item);
        } catch (error) {
            next(error);
        }
    },

    async analyzeText(req, res, next) {
        try {
            const { content } = req.body;
            const result = inboxService.analyzeText(content);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async trash(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const item = await inboxService.trash(userId, uid);
            res.json(item);
        } catch (error) {
            next(error);
        }
    },

    async restore(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const item = await inboxService.restore(userId, uid);
            res.json(item);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = inboxController;
