'use strict';

const axios = require('axios');
const http = require('http');
const https = require('https');
const { assertSafeUrl } = require('../url/ssrfGuard');
const {
    assertSafeCalDavUrl,
    guardedLookup,
    allowPrivateHosts,
    PRIVATE_ADDRESS_MESSAGE,
} = require('../caldav/services/safe-request');
const { AppError, ValidationError } = require('../../shared/errors');

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10000;
const MAX_BYTES = 5 * 1024 * 1024;

class FeedFetchError extends Error {}

// Addresses are checked again when the socket connects, so a host that
// resolves differently after the URL check still cannot reach the LAN.
// CALDAV_ALLOW_PRIVATE_HOSTS opens private addresses here too (#1719), but
// never link-local ones, where the cloud metadata service lives.
const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });

async function assertSafeFeedUrl(url) {
    if (allowPrivateHosts()) {
        try {
            await assertSafeCalDavUrl(url);
        } catch (err) {
            throw new FeedFetchError(err.message);
        }
        return;
    }
    try {
        await assertSafeUrl(url);
    } catch (err) {
        if (/^Could not resolve host/.test(err.message)) {
            throw new FeedFetchError('Could not reach the calendar');
        }
        if (/^Unsupported port/.test(err.message)) {
            throw new FeedFetchError(
                'That address points to a private or unsupported host'
            );
        }
        throw new FeedFetchError(PRIVATE_ADDRESS_MESSAGE);
    }
}

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

function describeFetchError(err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return 'The calendar took too long to respond';
    }
    if (
        err.code === 'ERR_BAD_RESPONSE' &&
        /maxContentLength/.test(err.message)
    ) {
        return 'The calendar is larger than 5 MB';
    }
    if (err.cause instanceof AppError) {
        return err.cause.message;
    }
    return 'Could not reach the calendar';
}

// Fetches an iCal feed server-side. Every hop is checked against the SSRF
// guard, since the URL is user-supplied and redirects can point anywhere.
async function fetchFeed(url) {
    let currentUrl = normalizeFeedUrl(url);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertSafeFeedUrl(currentUrl);

        let response;
        try {
            response = await axios.get(currentUrl, {
                httpAgent,
                httpsAgent,
                maxRedirects: 0,
                timeout: TIMEOUT_MS,
                maxContentLength: MAX_BYTES,
                responseType: 'text',
                transformResponse: [(data) => data],
                validateStatus: () => true,
                headers: {
                    Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1',
                    'User-Agent': 'tududi-calendar-feed',
                },
            });
        } catch (err) {
            throw new FeedFetchError(describeFetchError(err));
        }

        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.location;
            if (!location) {
                throw new FeedFetchError('The calendar redirected nowhere');
            }
            currentUrl = new URL(location, currentUrl).href;
            continue;
        }

        if (response.status < 200 || response.status >= 300) {
            throw new FeedFetchError(
                `The calendar answered with HTTP ${response.status}`
            );
        }

        const text = String(response.data ?? '');
        if (!text.includes('BEGIN:VCALENDAR')) {
            throw new FeedFetchError('That address did not return a calendar');
        }
        return text;
    }

    throw new FeedFetchError('The calendar redirected too many times');
}

module.exports = { fetchFeed, normalizeFeedUrl, FeedFetchError };
