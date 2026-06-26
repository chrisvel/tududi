'use strict';

const { getAuthenticatedUserId } = require('../../utils/request-utils');
const aiAssistantService = require('./service');

const controller = {
    async getCachedBrief(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const brief = await aiAssistantService.getCachedBrief(userId);
            res.json(brief || null);
        } catch (error) {
            next(error);
        }
    },

    async getCachedTaskInsights(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });
            const cached = await aiAssistantService.getCachedTaskInsights(
                req.params.taskUid,
                userId
            );
            res.json(cached || null);
        } catch (error) {
            next(error);
        }
    },

    async getTaskInsights(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const insights = await aiAssistantService.generateTaskInsights(
                req.body,
                userId
            );
            res.json(insights);
        } catch (error) {
            next(error);
        }
    },

    async updateTaskInsightsDismissed(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { dismissed } = req.body;
            if (typeof dismissed !== 'boolean') {
                return res
                    .status(400)
                    .json({ error: 'dismissed must be a boolean' });
            }
            const updated =
                await aiAssistantService.updateTaskInsightsDismissed(
                    req.params.taskUid,
                    userId,
                    dismissed
                );
            if (!updated) {
                return res
                    .status(404)
                    .json({ error: 'No insights found for this task' });
            }
            res.json(updated);
        } catch (error) {
            next(error);
        }
    },

    async getCachedProjectInsights(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });
            const cached = await aiAssistantService.getCachedProjectInsights(
                req.params.projectUid,
                userId
            );
            res.json(cached || null);
        } catch (error) {
            next(error);
        }
    },

    async getProjectInsights(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const insights = await aiAssistantService.generateProjectInsights(
                req.body,
                userId
            );
            res.json(insights);
        } catch (error) {
            next(error);
        }
    },

    async updateProjectInsightsDismissed(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { dismissed } = req.body;
            if (typeof dismissed !== 'boolean') {
                return res
                    .status(400)
                    .json({ error: 'dismissed must be a boolean' });
            }
            const updated =
                await aiAssistantService.updateProjectInsightsDismissed(
                    req.params.projectUid,
                    userId,
                    dismissed
                );
            if (!updated) {
                return res
                    .status(404)
                    .json({ error: 'No insights found for this project' });
            }
            res.json(updated);
        } catch (error) {
            next(error);
        }
    },

    async getDailyBrief(req, res, next) {
        console.log('[AI Assistant] getDailyBrief called');
        try {
            const userId = getAuthenticatedUserId(req);
            console.log('[AI Assistant] userId:', userId);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const brief = await aiAssistantService.generateDailyBrief(userId);
            res.json(brief);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = controller;
