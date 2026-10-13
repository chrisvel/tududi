'use strict';

// Life-to-Day (T-901, T-903): Google Calendar connection, read-only busy
// sync (blueprint 20.1 B) and blocks in the dedicated calendar (20.1 C).
const crypto = require('crypto');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const {
    sequelize,
    User,
    LtdGcalAccount,
    LtdExternalEventLink,
} = require('../../models');
const google = require('./google');
const secretCipher = require('../../shared/crypto/secretCipher');
const dailyPlanService = require('../daily-plan/service');
const { withJobLock } = require('../../services/jobLock');
const { ValidationError } = require('../../shared/errors');
const { getSafeTimezone } = require('../../utils/timezone-utils');

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
// ponytail: full sync has no time window (timeMin cannot be combined with
// the later syncToken), so rows that ended more than two days ago are
// dropped instead. Upgrade path: a windowed full sync if storage grows.
const KEEP_PAST_MS = 2 * 24 * 60 * 60 * 1000;
const CLOSED_TASK = [2, 3, 5];
const CALENDAR_NAME = 'Life-to-Day';

// NOT IN () matches nothing in SQL; an empty list means "every row".
const notIn = (ids) => (ids.length ? { [Op.notIn]: ids } : { [Op.ne]: null });
const b64url = (buf) => buf.toString('base64url');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

function requireConfig() {
    const cfg = google.config();
    if (!cfg) {
        throw new ValidationError(
            'Google Calendar is not set up on this server'
        );
    }
    return cfg;
}

// ---- OAuth ---------------------------------------------------------------

function startConnect(session, userId) {
    const cfg = requireConfig();
    if (!secretCipher.hasKeyMaterial()) {
        throw new ValidationError(
            'Set TUDUDI_SESSION_SECRET on the server before connecting Google'
        );
    }
    const state = b64url(crypto.randomBytes(32));
    const verifier = b64url(crypto.randomBytes(32));
    session.ltdGcal = { state, verifier, user_id: userId, at: Date.now() };
    return {
        url: google.authUrl(cfg, {
            state,
            challenge: b64url(sha256(verifier)),
        }),
    };
}

function sameString(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// The id_token comes straight from Google's token endpoint over TLS, so its
// claims are read without a signature check (OpenID Connect Core 3.1.3.7).
function subFrom(idToken) {
    try {
        const payload = idToken.split('.')[1];
        return JSON.parse(Buffer.from(payload, 'base64url').toString()).sub;
    } catch {
        return null;
    }
}

async function finishConnect(session, userId, query) {
    const pending = session.ltdGcal;
    delete session.ltdGcal;
    // State is single use, bound to this user and short lived (CSRF).
    if (
        !pending ||
        pending.user_id !== userId ||
        Date.now() - pending.at > STATE_MAX_AGE_MS ||
        !sameString(query.state, pending.state)
    ) {
        throw new ValidationError('This Google sign-in link has expired');
    }
    if (query.error || typeof query.code !== 'string') {
        throw new ValidationError('Google access was not granted');
    }
    const cfg = requireConfig();
    const tokens = await google.exchangeCode(cfg, query.code, pending.verifier);
    const granted = String(tokens.scope || '').split(' ');
    if (!tokens.refresh_token) {
        throw new ValidationError('Google did not return lasting access');
    }
    if (!google.READ_SCOPES.every((s) => granted.includes(s))) {
        await google.revoke(tokens.refresh_token).catch(() => {});
        throw new ValidationError(
            'Allow both calendar permissions to connect Google Calendar'
        );
    }
    await sequelize.transaction(async (transaction) => {
        await LtdExternalEventLink.destroy({
            where: { user_id: userId },
            transaction,
        });
        await LtdGcalAccount.destroy({
            where: { user_id: userId },
            transaction,
        });
        await LtdGcalAccount.create(
            {
                user_id: userId,
                google_sub: tokens.id_token ? subFrom(tokens.id_token) : null,
                refresh_token_enc: secretCipher.encrypt(tokens.refresh_token),
                scopes: granted.join(' '),
                status: 'active',
            },
            { transaction }
        );
    });
}

// ---- status and disconnect ------------------------------------------------

async function status(userId) {
    const account = await LtdGcalAccount.findOne({
        where: { user_id: userId },
    });
    return {
        available: !!google.config(),
        connected: !!account,
        status: account?.status ?? null,
        last_sync_at: account?.last_sync_at ?? null,
        last_error: account?.last_error ?? null,
        can_export: !!account?.scopes?.split(' ').includes(google.WRITE_SCOPE),
        export_enabled: !!account?.target_calendar_id,
    };
}

async function forget(userId) {
    await sequelize.transaction(async (transaction) => {
        await LtdExternalEventLink.destroy({
            where: { user_id: userId },
            transaction,
        });
        await LtdGcalAccount.destroy({
            where: { user_id: userId },
            transaction,
        });
    });
}

// Revokes at Google first; the local secret, sync tokens and links are
// removed whatever Google answers, and a failed revoke is reported.
async function disconnect(userId) {
    const account = await LtdGcalAccount.findOne({
        where: { user_id: userId },
    });
    if (!account) return { disconnected: true, revoked: true };
    let revoked = false;
    try {
        const refresh = secretCipher.decrypt(account.refresh_token_enc);
        if (account.target_calendar_id) {
            const cfg = requireConfig();
            const token = await google.accessToken(cfg, refresh);
            await google
                .deleteCalendar(token, account, account.target_calendar_id)
                .catch(() => {});
        }
        await google.revoke(refresh);
        revoked = true;
    } catch {
        revoked = false;
    } finally {
        await forget(userId);
    }
    return revoked
        ? { disconnected: true, revoked: true }
        : {
              disconnected: true,
              revoked: false,
              message:
                  'Removed here, but Google did not confirm. Remove Life-to-Day at myaccount.google.com/permissions.',
          };
}

// ---- read sync -----------------------------------------------------------

const isGone = (err) => err?.status === 410;
const isMissing = (err) => err?.status === 404 || err?.status === 410;

// A busy span, or null when the event should not count (or is gone).
function toRow(event, calendarTz, now = Date.now()) {
    if (event.status === 'cancelled') return null;
    // Anti-loop: blocks Life-to-Day wrote are never read back as busy time.
    if (event.extendedProperties?.private?.ltd_uid) return null;
    if (event.transparency === 'transparent') return null;
    if (event.eventType === 'workingLocation') return null;
    if (
        (event.attendees || []).some(
            (a) => a.self && a.responseStatus === 'declined'
        )
    ) {
        return null;
    }
    if (event.start?.date) {
        const end =
            event.end?.date ||
            moment(event.start.date).add(1, 'day').format('YYYY-MM-DD');
        if (moment.utc(end).valueOf() < now - KEEP_PAST_MS) return null;
        return {
            start_date: event.start.date,
            end_date: end,
            start_at: null,
            end_at: null,
            time_zone: null,
        };
    }
    const start = new Date(event.start?.dateTime);
    const end = new Date(event.end?.dateTime ?? event.start?.dateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }
    if (end.getTime() < now - KEEP_PAST_MS) return null;
    return {
        start_at: start,
        end_at: end,
        time_zone: event.start.timeZone || calendarTz || null,
        start_date: null,
        end_date: null,
    };
}

async function applyEvent(userId, calendarId, event, calendarTz) {
    const where = {
        user_id: userId,
        calendar_id: calendarId,
        event_id: event.id,
    };
    const row = toRow(event, calendarTz);
    if (!row) {
        await LtdExternalEventLink.destroy({
            where: { ...where, entity_type: 'busy' },
        });
        return;
    }
    const values = {
        ...where,
        source: 'gcal',
        entity_type: 'busy',
        etag: event.etag ?? null,
        ...row,
    };
    const existing = await LtdExternalEventLink.findOne({ where });
    if (existing) await existing.update(values);
    else await LtdExternalEventLink.create(values);
}

const clearCalendar = (userId, calendarId) =>
    LtdExternalEventLink.destroy({
        where: {
            user_id: userId,
            calendar_id: calendarId,
            entity_type: 'busy',
        },
    });

// Full sync (paged) or incremental with the stored token. The next token is
// kept only from the last page; 410 Gone clears the calendar and starts over.
async function syncCalendar(userId, token, calendarId, tokens, retried) {
    const syncToken = tokens[calendarId];
    const seen = new Set();
    let pageToken;
    for (;;) {
        let page;
        try {
            page = await google.listEvents(token, calendarId, {
                syncToken,
                pageToken,
            });
        } catch (err) {
            if (isGone(err) && !retried) {
                await clearCalendar(userId, calendarId);
                delete tokens[calendarId];
                return syncCalendar(userId, token, calendarId, tokens, true);
            }
            throw err;
        }
        for (const event of page.items || []) {
            seen.add(event.id);
            await applyEvent(userId, calendarId, event, page.timeZone);
        }
        if (page.nextPageToken) {
            pageToken = page.nextPageToken;
            continue;
        }
        if (!syncToken) {
            await LtdExternalEventLink.destroy({
                where: {
                    user_id: userId,
                    calendar_id: calendarId,
                    entity_type: 'busy',
                    event_id: notIn([...seen]),
                },
            });
        }
        if (page.nextSyncToken) tokens[calendarId] = page.nextSyncToken;
        return;
    }
}

function parseTokens(raw) {
    try {
        const parsed = JSON.parse(raw || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

async function syncAccount(account) {
    const cfg = requireConfig();
    let token;
    try {
        token = await google.accessToken(
            cfg,
            secretCipher.decrypt(account.refresh_token_enc)
        );
    } catch (err) {
        if (err?.reason === 'invalid_grant') {
            // Access was withdrawn at Google: fall back to iCal until the
            // user connects again.
            await account.update({
                status: 'revoked',
                last_error: 'Google access was withdrawn. Connect again.',
            });
            return;
        }
        throw err;
    }
    const tokens = parseTokens(account.sync_token);
    const calendars = (await google.listCalendars(token)).filter(
        (c) => c.selected && !c.deleted && c.id !== account.target_calendar_id
    );
    const ids = calendars.map((c) => c.id);
    for (const id of Object.keys(tokens)) {
        if (!ids.includes(id)) delete tokens[id];
    }
    await LtdExternalEventLink.destroy({
        where: {
            user_id: account.user_id,
            entity_type: 'busy',
            calendar_id: notIn(ids),
        },
    });
    for (const id of ids) {
        await syncCalendar(account.user_id, token, id, tokens, false);
    }
    await account.update({
        sync_token: JSON.stringify(tokens),
        last_sync_at: new Date(),
        last_error: null,
    });
    if (account.target_calendar_id) {
        const user = await User.findByPk(account.user_id);
        await exportBlocks(user, account, token);
    }
    // Disconnected while this ran: leave nothing behind.
    if (!(await LtdGcalAccount.count({ where: { id: account.id } }))) {
        await LtdExternalEventLink.destroy({
            where: { user_id: account.user_id },
        });
    }
}

async function syncUser(userId) {
    return withJobLock(`ltd-gcal:${userId}`, async () => {
        const account = await LtdGcalAccount.findOne({
            where: { user_id: userId, status: 'active' },
        });
        if (!account) return;
        try {
            await syncAccount(account);
        } catch (err) {
            await account
                .update({ last_error: err.message.slice(0, 200) })
                .catch(() => {});
        }
    });
}

// Worker entry: every active account once, one at a time.
async function syncAll() {
    if (!google.config()) return;
    const accounts = await LtdGcalAccount.findAll({
        where: { status: 'active' },
        attributes: ['user_id'],
    });
    for (const { user_id: userId } of accounts) await syncUser(userId);
}

// ---- blocks in the Life-to-Day calendar (T-903) --------------------------

const eventIdFor = (userId, key) =>
    sha256(`${userId}:${key}`).toString('hex').slice(0, 40);

async function desiredBlocks(user, dates, tz) {
    const desired = new Map();
    for (const date of dates) {
        const { plan } = await dailyPlanService.getPlan(user, date);
        for (const item of plan?.items || []) {
            if (item.start_minute === null || item.start_minute === undefined)
                continue;
            if (item.occurrence_done || CLOSED_TASK.includes(item.task?.status))
                continue;
            const key = `${date}:${item.task_uid}`;
            const start = moment.tz(date, 'YYYY-MM-DD', tz).set({
                hour: Math.floor(item.start_minute / 60),
                minute: item.start_minute % 60,
            });
            const end = start
                .clone()
                .add(item.duration_minutes || 0, 'minutes');
            desired.set(key, {
                summary: item.task?.name || CALENDAR_NAME,
                start: { dateTime: start.format(), timeZone: tz },
                end: { dateTime: end.format(), timeZone: tz },
                transparency: 'opaque',
                extendedProperties: { private: { ltd_uid: key } },
            });
        }
    }
    return desired;
}

// Today's and tomorrow's timed blocks. Life-to-Day wins every conflict on
// its own blocks: an unchanged hash writes nothing, a changed one overwrites.
async function exportBlocks(user, account, token) {
    const calendarId = account.target_calendar_id;
    if (!calendarId) return;
    const tz = getSafeTimezone(user.timezone);
    const today = moment.tz(tz);
    const dates = [0, 1].map((n) =>
        today.clone().add(n, 'day').format('YYYY-MM-DD')
    );
    const desired = await desiredBlocks(user, dates, tz);
    const links = await LtdExternalEventLink.findAll({
        where: {
            user_id: user.id,
            calendar_id: calendarId,
            entity_type: 'block',
        },
    });
    const byKey = new Map(links.map((l) => [l.entity_uid, l]));
    for (const link of links) {
        const managed = dates.some((d) => link.entity_uid?.startsWith(`${d}:`));
        if (!managed || desired.has(link.entity_uid)) continue;
        await google
            .deleteEvent(token, account, calendarId, link.event_id)
            .catch((err) => {
                if (!isMissing(err)) throw err;
            });
        await link.destroy();
    }
    for (const [key, body] of desired) {
        const hash = sha256(JSON.stringify(body)).toString('hex');
        const link = byKey.get(key);
        if (link?.last_hash === hash) continue;
        const id = link?.event_id || eventIdFor(user.id, key);
        let saved;
        if (link) {
            saved = await google
                .updateEvent(token, account, calendarId, id, body)
                .catch((err) => {
                    if (!isMissing(err)) throw err;
                    return google.insertEvent(token, account, calendarId, {
                        ...body,
                        id,
                    });
                });
        } else {
            saved = await google
                .insertEvent(token, account, calendarId, { ...body, id })
                .catch((err) => {
                    if (err?.status !== 409) throw err;
                    return google.updateEvent(
                        token,
                        account,
                        calendarId,
                        id,
                        body
                    );
                });
        }
        const values = {
            user_id: user.id,
            source: 'gcal',
            calendar_id: calendarId,
            event_id: id,
            entity_type: 'block',
            entity_uid: key,
            etag: saved?.etag ?? null,
            last_hash: hash,
        };
        if (link) await link.update(values);
        else await LtdExternalEventLink.create(values);
    }
}

async function setExport(user, on) {
    if (typeof on !== 'boolean') {
        throw new ValidationError('on must be true or false');
    }
    const account = await LtdGcalAccount.findOne({
        where: { user_id: user.id, status: 'active' },
    });
    if (!account) throw new ValidationError('Connect Google Calendar first');
    if (!account.scopes.split(' ').includes(google.WRITE_SCOPE)) {
        throw new ValidationError(
            'Connect again and allow Life-to-Day to make its own calendar'
        );
    }
    const token = await google.accessToken(
        requireConfig(),
        secretCipher.decrypt(account.refresh_token_enc)
    );
    if (on) {
        if (!account.target_calendar_id) {
            const created = await google.createCalendar(
                token,
                CALENDAR_NAME,
                getSafeTimezone(user.timezone)
            );
            await account.update({ target_calendar_id: created.id });
        }
        await exportBlocks(user, account, token);
    } else if (account.target_calendar_id) {
        await google
            .deleteCalendar(token, account, account.target_calendar_id)
            .catch((err) => {
                if (!isMissing(err)) throw err;
            });
        await LtdExternalEventLink.destroy({
            where: { user_id: user.id, entity_type: 'block' },
        });
        await account.update({ target_calendar_id: null });
    }
    return status(user.id);
}

module.exports = {
    startConnect,
    finishConnect,
    status,
    disconnect,
    syncUser,
    syncAll,
    setExport,
    exportBlocks,
    toRow,
};
