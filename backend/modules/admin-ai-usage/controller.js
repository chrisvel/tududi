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
    async list(req, res, next) {
        try {
            res.json(await service.list(requireUserId(req), req.query));
        } catch (error) {
            next(error);
        }
    },
};

module.exports = controller;
