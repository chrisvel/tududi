'use strict';

const goalsService = require('./service');
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
            const { area_id } = req.query;
            const goals = await goalsService.getAll(userId, area_id);
            res.json({ goals });
        } catch (err) {
            next(err);
        }
    },

    async getOne(req, res, next) {
        try {
            const userId = requireUserId(req);
            const goal = await goalsService.getByUid(userId, req.params.uid);
            res.json(goal);
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const goal = await goalsService.create(userId, req.body);
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
                req.body
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
            await goalsService.delete(userId, req.params.uid);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    },
};

module.exports = goalsController;
