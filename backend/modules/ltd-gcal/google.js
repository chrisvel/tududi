'use strict';

// Life-to-Day (T-901, T-903): plain fetch to Google's OAuth and Calendar
// REST endpoints (ADR-011; no googleapis package). Tokens never leave this
// file in an error message.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

// Read scopes plus calendar.app.created, which can only touch calendars this
// app created. calendar / calendar.events (every calendar) are never asked.
const READ_SCOPES = [
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
];
const WRITE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const SCOPES = ['openid', ...READ_SCOPES, WRITE_SCOPE];

// Only what busy time needs: no summary, description or location.
const EVENT_FIELDS =
    'items(id,etag,status,start,end,transparency,eventType,attendees(self,responseStatus),extendedProperties/private),nextPageToken,nextSyncToken,timeZone';

class GoogleError extends Error {
    constructor(status, reason) {
        super(`Google returned ${status}${reason ? ` (${reason})` : ''}`);
        this.status = status;
        this.reason = reason;
    }
}

function config() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    const { getConfig } = require('../../config/config');
    const redirectUri =
        process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
        `${getConfig().backendUrl.replace(/\/$/, '')}/api/ltd/gcal/callback`;
    return { clientId, clientSecret, redirectUri };
}

async function call(url, init = {}) {
    const res = await fetch(url, init);
    if (res.status === 204) return null;
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        // Only Google's short error code is kept, never the request.
        const reason =
            typeof body?.error === 'string'
                ? body.error
                : body?.error?.errors?.[0]?.reason || body?.error?.status;
        throw new GoogleError(res.status, reason);
    }
    return body;
}

const form = (params) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
});

function authUrl(cfg, { state, challenge }) {
    const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    });
    return `${AUTH_URL}?${params}`;
}

const exchangeCode = (cfg, code, verifier) =>
    call(
        TOKEN_URL,
        form({
            grant_type: 'authorization_code',
            code,
            code_verifier: verifier,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            redirect_uri: cfg.redirectUri,
        })
    );

async function accessToken(cfg, refreshToken) {
    const body = await call(
        TOKEN_URL,
        form({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
        })
    );
    return body.access_token;
}

const revoke = (token) => call(REVOKE_URL, form({ token }));

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const enc = encodeURIComponent;

async function listCalendars(token) {
    const out = [];
    let pageToken;
    do {
        const params = new URLSearchParams({ minAccessRole: 'reader' });
        if (pageToken) params.set('pageToken', pageToken);
        const page = await call(`${API}/users/me/calendarList?${params}`, {
            headers: bearer(token),
        });
        out.push(...(page.items || []));
        pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
}

// One page of events. Incremental pages repeat the same parameters with the
// sync token instead of anything time-based (Google's sync guide).
function listEvents(token, calendarId, { syncToken, pageToken }) {
    const params = new URLSearchParams({
        singleEvents: 'true',
        maxResults: '250',
        fields: EVENT_FIELDS,
    });
    if (syncToken) params.set('syncToken', syncToken);
    if (pageToken) params.set('pageToken', pageToken);
    return call(`${API}/calendars/${enc(calendarId)}/events?${params}`, {
        headers: bearer(token),
    });
}

// Every write goes through here. Anything that is not this account's own
// Life-to-Day calendar is refused before a request is built.
function assertWritable(account, calendarId) {
    if (
        typeof calendarId !== 'string' ||
        !calendarId ||
        calendarId === 'primary' ||
        calendarId !== account?.target_calendar_id
    ) {
        throw new Error('Refusing to write outside the Life-to-Day calendar');
    }
}

function write(token, account, calendarId, method, path, body) {
    assertWritable(account, calendarId);
    return call(`${API}/calendars/${enc(calendarId)}${path}`, {
        method,
        headers: { ...bearer(token), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
}

// Creating a secondary calendar is the one call without a calendar id; the
// calendar.app.created scope limits it to calendars this app owns.
const createCalendar = (token, summary, timeZone) =>
    call(`${API}/calendars`, {
        method: 'POST',
        headers: { ...bearer(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, timeZone }),
    });

const deleteCalendar = (token, account, calendarId) =>
    write(token, account, calendarId, 'DELETE', '');
const insertEvent = (token, account, calendarId, event) =>
    write(token, account, calendarId, 'POST', '/events', event);
const updateEvent = (token, account, calendarId, id, event) =>
    write(token, account, calendarId, 'PUT', `/events/${enc(id)}`, event);
const deleteEvent = (token, account, calendarId, id) =>
    write(token, account, calendarId, 'DELETE', `/events/${enc(id)}`);

module.exports = {
    READ_SCOPES,
    WRITE_SCOPE,
    SCOPES,
    GoogleError,
    config,
    authUrl,
    exchangeCode,
    accessToken,
    revoke,
    listCalendars,
    listEvents,
    assertWritable,
    createCalendar,
    deleteCalendar,
    insertEvent,
    updateEvent,
    deleteEvent,
};
