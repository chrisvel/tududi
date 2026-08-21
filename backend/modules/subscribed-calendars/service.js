'use strict';

const axios = require('axios');
const { SubscribedCalendar } = require('../../models');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const { parseEvents } = require('./ics');

const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_FEED_BYTES = 10 * 1024 * 1024;

// calendar id -> { fetchedAt, body }
const cache = new Map();

// webcal:// is just https:// with a scheme that tells the OS to subscribe.
function normalizeUrl(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (/^webcal:\/\//i.test(url)) {
        return `https://${url.slice('webcal://'.length)}`;
    }
    return url;
}

function assertFetchableUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw new ValidationError('URL must be a valid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new ValidationError('URL must be http, https or webcal');
    }
}

async function listCalendars(userId) {
    return SubscribedCalendar.findAll({
        where: { user_id: userId },
        order: [['created_at', 'ASC']],
    });
}

async function getCalendar(userId, uid) {
    const calendar = await SubscribedCalendar.findOne({
        where: { user_id: userId, uid },
    });
    if (!calendar) {
        throw new NotFoundError('Subscribed calendar not found');
    }
    return calendar;
}

async function createCalendar(userId, attributes) {
    const url = normalizeUrl(attributes.url);
    assertFetchableUrl(url);

    return SubscribedCalendar.create({
        user_id: userId,
        name: attributes.name,
        url,
        color: attributes.color || undefined,
    });
}

async function deleteCalendar(userId, uid) {
    const calendar = await getCalendar(userId, uid);
    cache.delete(calendar.id);
    await calendar.destroy();
}

async function fetchFeed(calendar) {
    const cached = cache.get(calendar.id);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.body;
    }

    const response = await axios.get(calendar.url, {
        timeout: REQUEST_TIMEOUT_MS,
        maxContentLength: MAX_FEED_BYTES,
        maxRedirects: 3,
        responseType: 'text',
        transformResponse: [(body) => body],
        headers: { Accept: 'text/calendar, text/plain' },
    });

    const body = String(response.data || '');
    cache.set(calendar.id, { fetchedAt: Date.now(), body });
    return body;
}

// Never surfaces the upstream response body: a subscribed URL is user supplied,
// so echoing what it returned would turn this into a fetch-anything proxy.
function describeFailure(error) {
    if (error.response) {
        return `Request failed with status ${error.response.status}`;
    }
    if (error.code === 'ECONNABORTED') {
        return 'Request timed out';
    }
    return 'Could not fetch calendar';
}

async function getEvents(userId, from, to) {
    const calendars = await listCalendars(userId);
    const events = [];

    for (const calendar of calendars) {
        try {
            const body = await fetchFeed(calendar);
            const parsed = parseEvents(body, from, to, calendar.id);

            for (const event of parsed) {
                events.push({
                    ...event,
                    calendar_uid: calendar.uid,
                    calendar_name: calendar.name,
                    color: calendar.color,
                });
            }

            if (calendar.last_error) {
                await calendar.update({ last_error: null });
            }
        } catch (error) {
            cache.delete(calendar.id);
            await calendar.update({ last_error: describeFailure(error) });
        }
    }

    return events;
}

module.exports = {
    listCalendars,
    createCalendar,
    deleteCalendar,
    getEvents,
};
