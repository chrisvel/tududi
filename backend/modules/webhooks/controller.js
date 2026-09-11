'use strict';

const webhooksService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        throw new UnauthorizedError('Authentication required');
    }
    return userId;
}

const webhooksController = {
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await webhooksService.list(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await webhooksService.create(userId, req.body);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await webhooksService.update(
                userId,
                req.params.uid,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async remove(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await webhooksService.remove(
                userId,
                req.params.uid
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async rotateSecret(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await webhooksService.rotateSecret(
                userId,
                req.params.uid
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async sendTest(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await webhooksService.sendTest(
                userId,
                req.params.uid
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = webhooksController;
