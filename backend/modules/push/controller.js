'use strict';

const service = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

const controller = {
    async getConfig(req, res, next) {
        try {
            requireUserId(req);
            res.json(await service.getPublicConfig());
        } catch (error) {
            next(error);
        }
    },

    async list(req, res, next) {
        try {
            res.json(await service.listSubscriptions(requireUserId(req)));
        } catch (error) {
            next(error);
        }
    },

    async subscribe(req, res, next) {
        try {
            res.status(201).json(
                await service.subscribe(
                    requireUserId(req),
                    req.body,
                    req.get('user-agent')
                )
            );
        } catch (error) {
            next(error);
        }
    },

    async unsubscribe(req, res, next) {
        try {
            res.json(await service.unsubscribe(requireUserId(req), req.body));
        } catch (error) {
            next(error);
        }
    },
};

module.exports = controller;
