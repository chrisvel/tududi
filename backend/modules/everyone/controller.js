'use strict';

const everyoneService = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

const everyoneController = {
    async get(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) throw new UnauthorizedError('Authentication required');
            const data = await everyoneService.getEveryoneDashboard(
                userId,
                req.currentUser?.timezone
            );
            res.json(data);
        } catch (err) {
            next(err);
        }
    },
};

module.exports = everyoneController;
