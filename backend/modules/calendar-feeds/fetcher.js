'use strict';

const axios = require('axios');
const http = require('http');
const https = require('https');
const { assertSafeUrl, publicOnlyLookup } = require('../url/ssrfGuard');
const { ValidationError } = require('../../shared/errors');

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10000;
const MAX_BYTES = 5 * 1024 * 1024;

class FeedFetchError extends Error {}

// Addresses are checked again when the socket connects, so a host that
// resolves differently after assertSafeUrl still cannot reach the LAN.
const httpAgent = new http.Agent({ lookup: publicOnlyLookup });
const httpsAgent = new https.Agent({ lookup: publicOnlyLookup });

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
    if (err.cause?.name === 'UnsafeUrlError' || err.name === 'UnsafeUrlError') {
        return 'That address points to a private or unsupported host';
    }
    return 'Could not reach the calendar';
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
