'use strict';

const goalsService = require('./service');
// LTD-PATCH(T-404): bearer integrations are non-human journal actors.
const { actorFromRequest } = require('../ltd-journal/actor');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

const goalsController = {
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { area_id, area_uid } = req.query;
            const goals = await goalsService.getAll(userId, area_id, area_uid);
            res.json({ goals });
        } catch (err) {
            next(err);
        }
    },

    /**
     * PUT /api/goals/order
     * Save the current user's custom order of goals.
     */
    async reorder(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await goalsService.reorder(
                userId,
                req.body?.goal_uids
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    },

    async getOne(req, res, next) {
        try {
            const userId = requireUserId(req);
            const goal = await goalsService.getByUid(userId, req.params.uid);
            res.json({ goal });
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const goal = await goalsService.create(
                userId,
                req.body,
                actorFromRequest(req, userId)
            );
            const activeCount = await goalsService.countActive(userId);
            res.status(201).json({ goal, active_goals_count: activeCount });
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const goal = await goalsService.update(
                userId,
                req.params.uid,
                req.body,
                actorFromRequest(req, userId)
            );
            const activeCount = await goalsService.countActive(userId);
            res.json({ goal, active_goals_count: activeCount });
        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            const userId = requireUserId(req);
            // LTD-PATCH(T-404): hard deletion belongs only to the signed-in human UI.
            if (!req.session?.userId || req.headers.authorization) {
                const { ForbiddenError } = require('../../shared/errors');
                throw new ForbiddenError(
                    'Only the signed-in human can delete a goal'
                );
            }
            await goalsService.delete(userId, req.params.uid);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    },
};

module.exports = goalsController;
