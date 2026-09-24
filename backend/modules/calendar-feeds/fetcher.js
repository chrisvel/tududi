'use strict';

const { assertSafeUrl } = require('../url/ssrfGuard');
const { ValidationError } = require('../../shared/errors');

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10000;
const MAX_BYTES = 5 * 1024 * 1024;

class FeedFetchError extends Error {}

// Calendar apps hand out webcal:// links; they are plain HTTPS underneath.
function normalizeFeedUrl(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new ValidationError('A calendar URL is required');
    }
    const trimmed = raw.trim().replace(/^webcals?:\/\//i, 'https://');
    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new ValidationError('That does not look like a calendar URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new ValidationError('Calendar URLs must start with https://');
    }
    return parsed.href;
}

async function readLimited(response) {
    const declared = Number(response.headers.get('content-length'));
    if (declared && declared > MAX_BYTES) {
        throw new FeedFetchError('The calendar is larger than 5 MB');
    }
    if (!response.body) return response.text();

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            await reader.cancel();
            throw new FeedFetchError('The calendar is larger than 5 MB');
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

// Fetches an iCal feed server-side. Every hop is checked against the SSRF
// guard, since the URL is user-supplied and redirects can point anywhere.
async function fetchFeed(url) {
    let currentUrl = normalizeFeedUrl(url);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        try {
            await assertSafeUrl(currentUrl);
        } catch {
            throw new FeedFetchError(
                'That address points to a private or unsupported host'
            );
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let response;
        try {
            response = await fetch(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                signal: controller.signal,
                headers: {
                    Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1',
                    'User-Agent': 'tududi-calendar-feed',
                },
            });
        } catch (err) {
            throw new FeedFetchError(
                err.name === 'AbortError'
                    ? 'The calendar took too long to respond'
                    : 'Could not reach the calendar'
            );
        } finally {
            clearTimeout(timer);
        }

        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            if (!location) {
                throw new FeedFetchError('The calendar redirected nowhere');
            }
            currentUrl = new URL(location, currentUrl).href;
            continue;
        }

        if (!response.ok) {
            throw new FeedFetchError(
                `The calendar answered with HTTP ${response.status}`
            );
        }

        const text = await readLimited(response);
        if (!text.includes('BEGIN:VCALENDAR')) {
            throw new FeedFetchError('That address did not return a calendar');
        }
        return text;
    }

    throw new FeedFetchError('The calendar redirected too many times');
}

module.exports = { fetchFeed, normalizeFeedUrl, FeedFetchError };
