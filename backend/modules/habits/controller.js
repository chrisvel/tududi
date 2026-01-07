'use strict';

const habitsService = require('./service');

const habitsController = {
    async getAll(req, res, next) {
        try {
            const result = await habitsService.getAll(req.currentUser.id);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async create(req, res, next) {
        try {
            const result = await habitsService.create(
                req.currentUser.id,
                req.body
            );
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    async logCompletion(req, res, next) {
        try {
            const result = await habitsService.logCompletion(
                req.currentUser.id,
                req.params.uid,
                req.body.completed_at
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async getCompletions(req, res, next) {
        try {
            const { start_date, end_date } = req.query;
            const result = await habitsService.getCompletions(
                req.currentUser.id,
                req.params.uid,
                start_date,
                end_date
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async deleteCompletion(req, res, next) {
        try {
            const result = await habitsService.deleteCompletion(
                req.currentUser.id,
                req.params.uid,
                req.params.completionId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async getStats(req, res, next) {
        try {
            const { start_date, end_date } = req.query;
            const result = await habitsService.getStats(
                req.currentUser.id,
                req.params.uid,
                start_date,
                end_date
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async update(req, res, next) {
        try {
            const result = await habitsService.update(
                req.currentUser.id,
                req.params.uid,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async delete(req, res, next) {
        try {
            const result = await habitsService.delete(
                req.currentUser.id,
                req.params.uid
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = habitsController;
