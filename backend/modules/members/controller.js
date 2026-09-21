'use strict';

const membersService = require('./service');
const signInLinkService = require('./signInLinkService');
const auditService = require('../oidc/auditService');
const { validateUserId } = require('../admin/validation');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

const requireUserId = (req) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
};

const membersController = {
    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const member = await membersService.createMember(userId, req.body);
            res.status(201).json(member);
        } catch (err) {
            next(err);
        }
    },

    async createSignInLink(req, res, next) {
        try {
            const actorId = requireUserId(req);
            const memberId = validateUserId(req.params.id);
            const link = await signInLinkService.create(actorId, memberId);
            await auditService.logSignInLinkCreated(memberId, actorId, req);
            res.status(201).json(link);
        } catch (err) {
            next(err);
        }
    },

    async revokeSignInLink(req, res, next) {
        try {
            const actorId = requireUserId(req);
            const memberId = validateUserId(req.params.id);
            await signInLinkService.revoke(actorId, memberId);
            await auditService.logSignInLinkRevoked(memberId, actorId, req);
            res.status(204).end();
        } catch (err) {
            next(err);
        }
    },
};

module.exports = membersController;
