'use strict';

const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { CalendarEvent } = require('../../models');
const {
    syncUserIcs,
    lockUserSync,
    unlockUserSync,
} = require('./calendarSyncService');
const { logError } = require('../../services/logService');
const {
    getSafeTimezone,
    getTodayBoundsInUTC,
    getUpcomingRangeInUTC,
} = require('../../utils/timezone-utils');
const { generateGroupName } = require('../tasks/operations/grouping');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

/**
 * POST /calendar/sync
 * Trigger manual calendar sync for the authenticated user
 *
 * @returns {Object} sync results with counts and timestamp
 * @returns {number} added - Number of new events added
 * @returns {number} updated - Number of events updated
 * @returns {number} deleted - Number of events deleted
 * @returns {number} skippedNotModified - Number of events skipped (unchanged)
 * @returns {string} syncedAt - ISO timestamp of sync completion
 */
router.post('/calendar/sync', async (req, res, next) => {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = await require('../../models').User.findByPk(userId, {
            attributes: ['id', 'calendar_settings'],
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const settings =
            typeof user.calendar_settings === 'string'
                ? JSON.parse(user.calendar_settings)
                : user.calendar_settings;

        if (settings?.enabled !== true || !settings?.icsUrl) {
            return res.status(400).json({
                error: 'Calendar not configured',
                message: 'Calendar is not enabled or ICS URL is not set.',
            });
        }

        const lockAcquired = await lockUserSync(userId);

        if (!lockAcquired) {
            return res.status(409).json({
                error: 'Sync in progress',
                message:
                    'A calendar sync is already in progress for this user. Please try again later.',
            });
        }

        try {
            const result = await syncUserIcs(userId);

            return res.status(200).json({
                added: result.added,
                updated: result.updated,
                deleted: result.deleted,
                skippedNotModified: result.skippedNotModified,
                syncedAt: result.syncedAt,
            });
        } finally {
            await unlockUserSync(userId);
        }
    } catch (error) {
        logError(
            `Error during manual calendar sync for user ${userId}:`,
            error
        );

        await unlockUserSync(userId);

        return res.status(500).json({
            error: 'Sync failed',
            message: error.message || 'An error occurred during calendar sync.',
        });
    }
});

/**
 * POST /calendar/sync-if-stale
 * Trigger sync only if user is due based on syncPreset and lastSyncedAt
 *
 * @returns {Object} { triggered: boolean }
 */
router.post('/calendar/sync-if-stale', async (req, res, next) => {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = await require('../../models').User.findByPk(userId, {
            attributes: ['id', 'calendar_settings'],
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const settings =
            typeof user.calendar_settings === 'string'
                ? JSON.parse(user.calendar_settings)
                : user.calendar_settings;

        if (settings?.enabled !== true || !settings?.icsUrl) {
            return res.status(400).json({
                error: 'Calendar not configured',
                message: 'Calendar is not enabled or ICS URL is not set.',
            });
        }

        const { isUserDueForSync } = require('./calendarSyncService');
        const isDue = isUserDueForSync(settings);

        if (!isDue) {
            return res.status(200).json({ triggered: false });
        }

        const lockAcquired = await lockUserSync(userId);

        if (!lockAcquired) {
            return res.status(200).json({ triggered: false });
        }

        try {
            await syncUserIcs(userId);
            return res.status(200).json({ triggered: true });
        } finally {
            await unlockUserSync(userId);
        }
    } catch (error) {
        logError(`Error during sync-if-stale for user ${userId}:`, error);

        await unlockUserSync(userId);

        return res.status(500).json({
            error: 'Sync check failed',
            message: error.message || 'An error occurred during sync check.',
        });
    }
});

router.get('/calendar/events', async (req, res) => {
    try {
        const { type, maxDays, groupBy } = req.query;
        const queryType = type || 'upcoming';
        const groupByType = groupBy || 'day';
        const days = maxDays ? parseInt(maxDays, 10) : 7;

        if (!['today', 'upcoming'].includes(queryType)) {
            return res.status(400).json({ error: 'Invalid type parameter.' });
        }

        if (Number.isNaN(days) || days <= 0) {
            return res
                .status(400)
                .json({ error: 'Invalid maxDays parameter.' });
        }

        const { id: userId, timezone, language } = req.currentUser;
        const safeTimezone = getSafeTimezone(timezone);

        const range =
            queryType === 'today'
                ? getTodayBoundsInUTC(safeTimezone)
                : getUpcomingRangeInUTC(safeTimezone, days);

        const events = await CalendarEvent.findAll({
            where: {
                user_id: userId,
                starts_at: {
                    [Op.between]: [range.start, range.end],
                },
            },
            order: [['starts_at', 'ASC']],
        });

        const rangeStartDate = moment
            .tz(range.start, safeTimezone)
            .format('YYYY-MM-DD');
        const rangeEndDate = moment
            .tz(range.end, safeTimezone)
            .format('YYYY-MM-DD');

        const expandedEvents = [];

        events.forEach((event) => {
            const eventData = event.toJSON();
            const eventStart = moment
                .utc(event.starts_at)
                .tz(safeTimezone)
                .startOf('day');
            const rawEnd = event.ends_at || event.starts_at;
            let eventEnd = moment.utc(rawEnd).tz(safeTimezone).startOf('day');

            if (eventEnd.isBefore(eventStart)) {
                eventEnd = eventStart.clone();
            }

            const current = eventStart.clone();
            while (current.isSameOrBefore(eventEnd, 'day')) {
                const dateKey = current.format('YYYY-MM-DD');
                if (dateKey >= rangeStartDate && dateKey <= rangeEndDate) {
                    expandedEvents.push({
                        ...eventData,
                        occurrence_date: dateKey,
                    });
                }
                current.add(1, 'day');
            }
        });

        let groupedEvents = null;
        if (groupByType === 'day') {
            const buckets = new Map();
            expandedEvents.forEach((event) => {
                const dateKey = event.occurrence_date;
                if (!buckets.has(dateKey)) {
                    buckets.set(dateKey, []);
                }
                buckets.get(dateKey).push(event);
            });

            const now = moment.tz(safeTimezone);
            groupedEvents = {};
            Array.from(buckets.keys())
                .sort()
                .forEach((dateKey) => {
                    const groupName = generateGroupName(
                        dateKey,
                        now,
                        safeTimezone,
                        language || 'en'
                    );
                    groupedEvents[groupName] = buckets.get(dateKey);
                });
        }

        return res.status(200).json({
            events: expandedEvents,
            groupedEvents,
        });
    } catch (error) {
        logError('Error fetching calendar events:', error);
        return res.status(500).json({
            error: 'Failed to fetch calendar events.',
        });
    }
});

module.exports = router;
