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
    async submit(req, res, next) {
        try {
            const result = await service.submit(
                requireUserId(req),
                req.body,
                req.get('user-agent')
            );
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    async list(req, res, next) {
        try {
            res.json(await service.list(requireUserId(req), req.query));
        } catch (error) {
            next(error);
        }
    },

    async setResolved(req, res, next) {
        try {
            res.json(
                await service.setResolved(
                    requireUserId(req),
                    req.params.id,
                    req.body
                )
            );
        } catch (error) {
            next(error);
        }
    },

    async remove(req, res, next) {
        try {
            await service.remove(requireUserId(req), req.params.id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },
};

module.exports = controller;
