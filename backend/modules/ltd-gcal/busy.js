'use strict';

// Life-to-Day (T-902): the one busy source for the planner. A connected,
// active Google account replaces the iCal feeds for that user, so the same
// meeting is never counted twice; without one the iCal path is unchanged.
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { LtdGcalAccount, LtdExternalEventLink } = require('../../models');
const calendarFeeds = require('../calendar-feeds/service');
const { ValidationError } = require('../../shared/errors');
const {
    getSafeTimezone,
    getCurrentDateInTimezone,
} = require('../../utils/timezone-utils');

const activeAccount = (userId) =>
    LtdGcalAccount.findOne({ where: { user_id: userId, status: 'active' } });

// Wall-clock minute of the day, so a DST day still lines up with work hours.
const wallMinute = (m, dayEnd) =>
    m.isSameOrAfter(dayEnd) ? 24 * 60 : m.hours() * 60 + m.minutes();

function toEvent(row, dayStart, dayEnd, tz) {
    if (row.start_date) {
        return {
            uid: row.event_id,
            source: 'gcal',
            all_day: true,
            busy: true,
            start: row.start_date,
            end: row.end_date,
            start_minute: null,
            end_minute: null,
        };
    }
    const start = moment(row.start_at).tz(tz);
    const end = moment(row.end_at).tz(tz);
    return {
        uid: row.event_id,
        source: 'gcal',
        all_day: false,
        busy: true,
        start: start.toISOString(),
        end: end.toISOString(),
        start_minute: start.isAfter(dayStart) ? wallMinute(start, dayEnd) : 0,
        end_minute: wallMinute(moment.min(end, dayEnd), dayEnd),
    };
}

// Same shape as calendarFeeds.eventsForDay. Google rows carry no title.
async function eventsForDay(user, date) {
    const account = await activeAccount(user.id);
    if (!account) return calendarFeeds.eventsForDay(user, date);

    const tz = getSafeTimezone(user.timezone);
    const day = date || getCurrentDateInTimezone(tz);
    if (!moment(day, 'YYYY-MM-DD', true).isValid()) {
        throw new ValidationError('date must be a YYYY-MM-DD date');
    }
    const dayStart = moment.tz(day, 'YYYY-MM-DD', tz);
    const dayEnd = dayStart.clone().add(1, 'day');
    const rows = await LtdExternalEventLink.findAll({
        where: {
            user_id: user.id,
            entity_type: 'busy',
            [Op.or]: [
                {
                    start_at: { [Op.lt]: dayEnd.toDate() },
                    end_at: { [Op.gt]: dayStart.toDate() },
                },
                {
                    start_date: { [Op.lte]: day },
                    end_date: { [Op.gt]: day },
                },
            ],
        },
    });
    const events = rows
        .map((row) => toEvent(row, dayStart, dayEnd, tz))
        .sort(
            (a, b) =>
                (a.all_day ? -1 : 0) - (b.all_day ? -1 : 0) ||
                (a.start_minute ?? 0) - (b.start_minute ?? 0)
        );
    return { date: day, events, errors: [] };
}

module.exports = { eventsForDay, activeAccount };
