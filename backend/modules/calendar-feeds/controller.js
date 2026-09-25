'use strict';

const calendarFeedsService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');

function requireUser(req) {
    if (!req.currentUser)
        throw new UnauthorizedError('Authentication required');
    return req.currentUser;
}

const calendarFeedsController = {
    async list(req, res, next) {
        try {
            const user = requireUser(req);
            res.json({ feeds: await calendarFeedsService.list(user.id) });
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            const user = requireUser(req);
            const feed = await calendarFeedsService.create(user.id, req.body);
            res.status(201).json({ feed });
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            const user = requireUser(req);
            const feed = await calendarFeedsService.update(
                user.id,
                req.params.uid,
                req.body
            );
            res.json({ feed });
        } catch (err) {
            next(err);
        }
    },

    async remove(req, res, next) {
        try {
            const user = requireUser(req);
            await calendarFeedsService.remove(user.id, req.params.uid);
            res.status(204).end();
        } catch (err) {
            next(err);
        }
    },

    async events(req, res, next) {
        try {
            const user = requireUser(req);
            const { from, to, date } = req.query;
            if (from !== undefined || to !== undefined) {
                return res.json(
                    await calendarFeedsService.eventsForRange(user, from, to)
                );
            }
            res.json(await calendarFeedsService.eventsForDay(user, date));
        } catch (err) {
            next(err);
        }
    },
};

module.exports = calendarFeedsController;
