'use strict';

const habitsService = require('./service');

const handle = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};

const habitsController = {
    getAll: handle(async (req, res) => {
        res.json(
            await habitsService.getAll(req.currentUser.id, {
                archived: req.query.archived === 'true',
            })
        );
    }),

    getOne: handle(async (req, res) => {
        res.json(
            await habitsService.getOne(req.currentUser.id, req.params.uid)
        );
    }),

    create: handle(async (req, res) => {
        res.status(201).json(
            await habitsService.create(req.currentUser.id, req.body)
        );
    }),

    logCompletion: handle(async (req, res) => {
        res.json(
            await habitsService.logCompletion(
                req.currentUser.id,
                req.params.uid,
                req.body
            )
        );
    }),

    skipDay: handle(async (req, res) => {
        res.json(
            await habitsService.skipDay(
                req.currentUser.id,
                req.params.uid,
                req.body
            )
        );
    }),

    getCompletions: handle(async (req, res) => {
        const { start_date, end_date } = req.query;
        res.json(
            await habitsService.getCompletions(
                req.currentUser.id,
                req.params.uid,
                start_date,
                end_date
            )
        );
    }),

    updateCompletion: handle(async (req, res) => {
        res.json(
            await habitsService.updateCompletion(
                req.currentUser.id,
                req.params.uid,
                req.params.completionId,
                req.body
            )
        );
    }),

    deleteCompletion: handle(async (req, res) => {
        res.json(
            await habitsService.deleteCompletion(
                req.currentUser.id,
                req.params.uid,
                req.params.completionId
            )
        );
    }),

    getStats: handle(async (req, res) => {
        const { start_date, end_date } = req.query;
        res.json(
            await habitsService.getStats(
                req.currentUser.id,
                req.params.uid,
                start_date,
                end_date
            )
        );
    }),

    update: handle(async (req, res) => {
        res.json(
            await habitsService.update(
                req.currentUser.id,
                req.params.uid,
                req.body
            )
        );
    }),

    archive: handle(async (req, res) => {
        res.json(
            await habitsService.setArchived(
                req.currentUser.id,
                req.params.uid,
                true
            )
        );
    }),

    unarchive: handle(async (req, res) => {
        res.json(
            await habitsService.setArchived(
                req.currentUser.id,
                req.params.uid,
                false
            )
        );
    }),

    delete: handle(async (req, res) => {
        res.json(
            await habitsService.delete(req.currentUser.id, req.params.uid)
        );
    }),
};

module.exports = habitsController;
