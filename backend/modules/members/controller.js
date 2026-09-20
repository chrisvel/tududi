'use strict';

const membersService = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

const membersController = {
    async create(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) throw new UnauthorizedError('Authentication required');
            const member = await membersService.createMember(userId, req.body);
            res.status(201).json(member);
        } catch (err) {
            next(err);
        }
    },
};

module.exports = membersController;
