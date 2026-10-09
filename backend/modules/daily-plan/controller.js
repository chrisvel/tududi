'use strict';

const dailyPlanService = require('./service');
const dailyPlanAi = require('./ai');
const { UnauthorizedError } = require('../../shared/errors');

function requireUser(req) {
    if (!req.currentUser)
        throw new UnauthorizedError('Authentication required');
    return req.currentUser;
}

const dailyPlanController = {
    async get(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.getPlan(user, req.query.date));
        } catch (err) {
            next(err);
        }
    },

    async candidates(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(
                await dailyPlanService.getCandidates(user, {
                    suggestedLimit: dailyPlanService.parseSuggestedLimit(
                        req.query.suggested_limit
                    ),
                })
            );
        } catch (err) {
            next(err);
        }
    },

    async getRanking(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.getRanking(user));
        } catch (err) {
            next(err);
        }
    },

    async saveRanking(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.saveRanking(user, req.body?.order));
        } catch (err) {
            next(err);
        }
    },

    async getSuggestionSettings(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.getSuggestionSettings(user));
        } catch (err) {
            next(err);
        }
    },

    async saveSuggestionSettings(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(
                await dailyPlanService.saveSuggestionSettings(user, req.body)
            );
        } catch (err) {
            next(err);
        }
    },

    async getDayHours(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.getDayHours(user));
        } catch (err) {
            next(err);
        }
    },

    async saveDayHours(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.saveDayHours(user, req.body));
        } catch (err) {
            next(err);
        }
    },

    async replace(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(
                await dailyPlanService.replaceItems(
                    user,
                    req.params.date,
                    req.body?.items
                )
            );
        } catch (err) {
            next(err);
        }
    },

    async start(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.startPlan(user, req.params.date));
        } catch (err) {
            next(err);
        }
    },

    async clear(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanService.clearPlan(user, req.params.date));
        } catch (err) {
            next(err);
        }
    },

    async carryOver(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(
                await dailyPlanService.carryOver(
                    user,
                    req.params.date,
                    req.body?.task_uids
                )
            );
        } catch (err) {
            next(err);
        }
    },

    async aiDraft(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(
                await dailyPlanAi.draftDay(user.id, {
                    date: req.body?.date,
                    mode: req.body?.mode,
                })
            );
        } catch (err) {
            next(err);
        }
    },

    async aiEstimates(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(
                await dailyPlanAi.estimateTasks(user.id, req.body?.task_uids)
            );
        } catch (err) {
            next(err);
        }
    },

    async aiWrapUp(req, res, next) {
        try {
            const user = requireUser(req);
            res.json(await dailyPlanAi.wrapUpDay(user.id, req.params.date));
        } catch (err) {
            next(err);
        }
    },
};

module.exports = dailyPlanController;
