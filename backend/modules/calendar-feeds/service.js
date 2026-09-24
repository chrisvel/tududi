'use strict';

const { CalendarFeed } = require('../../models');
const secretCipher = require('../../shared/crypto/secretCipher');
const { ValidationError, NotFoundError } = require('../../shared/errors');
const {
    getSafeTimezone,
    getCurrentDateInTimezone,
} = require('../../utils/timezone-utils');
const { fetchFeed, normalizeFeedUrl, FeedFetchError } = require('./fetcher');
const { parseCalendar, eventsForDate } = require('./icsEvents');
const moment = require('moment-timezone');

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_FEEDS_PER_USER = 10;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Parsed feeds per process, keyed by feed uid. A feed changes rarely and
// Google only refreshes its secret address every few hours anyway.
const cache = new Map();

function serializeFeed(feed) {
    return {
        uid: feed.uid,
        name: feed.name,
        url_host: feed.url_host,
        color: feed.color,
        last_fetched_at: feed.last_fetched_at,
        last_error: feed.last_error,
    };
}

function validateName(name) {
    if (typeof name !== 'string' || !name.trim()) {
        throw new ValidationError('Give the calendar a name');
    }
    return name.trim().slice(0, 100);
}

function validateColor(color) {
    if (color === undefined || color === null || color === '') return null;
    if (typeof color !== 'string' || !COLOR_PATTERN.test(color)) {
        throw new ValidationError('color must be a #rrggbb value');
    }
    return color;
}

function encryptUrl(url) {
    if (!secretCipher.hasKeyMaterial()) {
        throw new ValidationError(
            'Cannot save a calendar address: set TUDUDI_SESSION_SECRET (or TUDUDI_OIDC_SECRET_ENCRYPTION_KEY) on the server first'
        );
    }
    return secretCipher.encrypt(url);
}

// Fetches and parses once up front so a wrong or private address is
// rejected when it is added, not later on the Today page.
async function loadAndCheck(url) {
    try {
        const text = await fetchFeed(url);
        return parseCalendar(text);
    } catch (err) {
        if (err instanceof FeedFetchError) {
            throw new ValidationError(err.message);
        }
        throw new ValidationError('That address did not return a calendar');
    }
}

async function findOwned(userId, uid) {
    const feed = await CalendarFeed.findOne({
        where: { user_id: userId, uid },
    });
    if (!feed) throw new NotFoundError('Calendar not found');
    return feed;
}

async function list(userId) {
    const feeds = await CalendarFeed.findAll({
        where: { user_id: userId },
        order: [['created_at', 'ASC']],
    });
    return feeds.map(serializeFeed);
}

async function create(userId, body = {}) {
    const count = await CalendarFeed.count({ where: { user_id: userId } });
    if (count >= MAX_FEEDS_PER_USER) {
        throw new ValidationError(
            `You can add up to ${MAX_FEEDS_PER_USER} calendars`
        );
    }

    const name = validateName(body.name);
    const color = validateColor(body.color);
    const url = normalizeFeedUrl(body.url);
    const events = await loadAndCheck(url);

    const feed = await CalendarFeed.create({
        user_id: userId,
        name,
        color,
        url_encrypted: encryptUrl(url),
        url_host: new URL(url).host,
        last_fetched_at: new Date(),
    });
    cache.set(feed.uid, { events, fetchedAt: Date.now() });
    return serializeFeed(feed);
}

async function update(userId, uid, body = {}) {
    const feed = await findOwned(userId, uid);
    const updates = {};
    if (body.name !== undefined) updates.name = validateName(body.name);
    if (body.color !== undefined) updates.color = validateColor(body.color);
    if (body.url !== undefined && body.url !== '') {
        const url = normalizeFeedUrl(body.url);
        const events = await loadAndCheck(url);
        updates.url_encrypted = encryptUrl(url);
        updates.url_host = new URL(url).host;
        updates.last_fetched_at = new Date();
        updates.last_error = null;
        cache.set(feed.uid, { events, fetchedAt: Date.now() });
    }
    await feed.update(updates);
    return serializeFeed(feed);
}

async function remove(userId, uid) {
    const feed = await findOwned(userId, uid);
    cache.delete(feed.uid);
    await feed.destroy();
}

async function loadFeedEvents(feed) {
    const cached = cache.get(feed.uid);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.events;
    }

    try {
        const url = secretCipher.decrypt(feed.url_encrypted);
        const events = parseCalendar(await fetchFeed(url));
        cache.set(feed.uid, { events, fetchedAt: Date.now() });
        await feed.update({ last_fetched_at: new Date(), last_error: null });
        return events;
    } catch (err) {
        const message =
            err instanceof FeedFetchError
                ? err.message
                : 'Could not read this calendar';
        await feed.update({ last_error: message });
        // Keep showing the last good copy rather than an empty day.
        if (cached) return cached.events;
        throw new FeedFetchError(message);
    }
}

async function eventsForDay(user, date) {
    const timezone = getSafeTimezone(user.timezone);
    const day =
        date && moment(date, 'YYYY-MM-DD', true).isValid()
            ? date
            : getCurrentDateInTimezone(timezone);
    if (date && date !== day) {
        throw new ValidationError('date must be a YYYY-MM-DD date');
    }

    const feeds = await CalendarFeed.findAll({
        where: { user_id: user.id },
        order: [['created_at', 'ASC']],
    });

    const events = [];
    const errors = [];
    await Promise.all(
        feeds.map(async (feed) => {
            try {
                const parsed = await loadFeedEvents(feed);
                for (const event of eventsForDate(parsed, day, timezone)) {
                    events.push({
                        ...event,
                        feed_uid: feed.uid,
                        feed_name: feed.name,
                        color: feed.color,
                    });
                }
            } catch (err) {
                errors.push({ feed_uid: feed.uid, message: err.message });
            }
        })
    );

    events.sort((a, b) => {
        if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
        return (a.start_minute ?? 0) - (b.start_minute ?? 0);
    });

    return { date: day, events, errors };
}

function clearCache() {
    cache.clear();
}

module.exports = { list, create, update, remove, eventsForDay, clearCache };
