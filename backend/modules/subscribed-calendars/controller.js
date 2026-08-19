'use strict';

const service = require('./service');

const DEFAULT_WINDOW_DAYS = 60;

function parseDate(value, fallback) {
    if (!value) return fallback;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

const subscribedCalendarsController = {
    async getAll(req, res, next) {
        try {
            const calendars = await service.listCalendars(req.currentUser.id);
            res.json(calendars);
        } catch (error) {
            next(error);
        }
    },

    async create(req, res, next) {
        try {
            const calendar = await service.createCalendar(
                req.currentUser.id,
                req.body
            );
            res.status(201).json(calendar);
        } catch (error) {
            next(error);
        }
    },

    async delete(req, res, next) {
        try {
            await service.deleteCalendar(req.currentUser.id, req.params.uid);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    },

    async getEvents(req, res, next) {
        try {
            const now = new Date();
            const start = parseDate(req.query.start, now);
            const end = parseDate(
                req.query.end,
                new Date(
                    now.getTime() + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000
                )
            );

            if (!start || !end) {
                return res
                    .status(400)
                    .json({ error: 'start and end must be valid dates' });
            }
            if (end < start) {
                return res
                    .status(400)
                    .json({ error: 'end must be after start' });
            }

            const events = await service.getEvents(
                req.currentUser.id,
                start,
                end
            );
            res.json({ events });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = subscribedCalendarsController;
