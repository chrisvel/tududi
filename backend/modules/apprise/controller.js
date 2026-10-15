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
            res.json(await service.getConfig(requireUserId(req)));
        } catch (error) {
            next(error);
        }
    },

    async saveConfig(req, res, next) {
        try {
            res.json(await service.saveConfig(requireUserId(req), req.body));
        } catch (error) {
            next(error);
        }
    },

    async removeConfig(req, res, next) {
        try {
            res.json(await service.removeConfig(requireUserId(req)));
        } catch (error) {
            next(error);
        }
    },

    async test(req, res, next) {
        try {
            res.json(await service.sendTest(requireUserId(req)));
        } catch (error) {
            next(error);
        }
    },
};

module.exports = controller;
