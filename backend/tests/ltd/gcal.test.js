'use strict';
// Life-to-Day (T-901, T-902, T-903): Google Calendar against nock fixtures.
// No request leaves the process; every Google answer below is recorded here.
process.env.GOOGLE_CALENDAR_CLIENT_ID = 'fixture-client-id';
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'fixture-client-secret';
process.env.GOOGLE_CALENDAR_REDIRECT_URI =
    'https://ltd.example.test/api/ltd/gcal/callback';
process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'fixture-session-secret';

const crypto = require('crypto');
const nock = require('nock');
const request = require('supertest');
const app = require('../../app');
const { Task, LtdGcalAccount, LtdExternalEventLink } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const google = require('../../modules/ltd-gcal/google');
const gcal = require('../../modules/ltd-gcal/service');
const busy = require('../../modules/ltd-gcal/busy');
const planner = require('../../modules/ltd-planner/service');
const dailyPlan = require('../../modules/daily-plan/service');
const calendarFeeds = require('../../modules/calendar-feeds/service');
const secretCipher = require('../../shared/crypto/secretCipher');
const scheduler = require('../../modules/tasks/taskScheduler');

const OAUTH = 'https://oauth2.googleapis.com';
const API = 'https://www.googleapis.com';
const ME = 'me@example.com';
const TEAM = 'team@group.calendar.google.com';
const LTD = 'ltd-cal@group.calendar.google.com';
const REFRESH = 'fixture-refresh-token';
const eventsPath = (id) =>
    `/calendar/v3/calendars/${encodeURIComponent(id)}/events`;
const form = (body) =>
    typeof body === 'string'
        ? Object.fromEntries(new URLSearchParams(body))
        : body;
const timed = (id, start, end, extra = {}) => ({
    id,
    etag: `"${id}"`,
    status: 'confirmed',
    start: { dateTime: start },
    end: { dateTime: end },
    ...extra,
});

let seq = 0;
async function makeUser(timezone = 'UTC') {
    seq += 1;
    return createTestUser({ email: `gcal${seq}@example.com`, timezone });
}
const connect = (user, extra = {}) =>
    LtdGcalAccount.create({
        user_id: user.id,
        refresh_token_enc: secretCipher.encrypt(REFRESH),
        scopes: google.SCOPES.join(' '),
        status: 'active',
        ...extra,
    });
const refreshOk = () =>
    nock(OAUTH)
        .post('/token', (b) => form(b).grant_type === 'refresh_token')
        .reply(200, { access_token: 'fixture-access', expires_in: 3600 });
const calendarList = (items) =>
    nock(API)
        .get('/calendar/v3/users/me/calendarList')
        .query(true)
        .reply(200, { items });
const listEvents = (calendarId, match, reply, status = 200) =>
    nock(API).get(eventsPath(calendarId)).query(match).reply(status, reply);
const links = (user, where = {}) =>
    LtdExternalEventLink.findAll({
        where: { user_id: user.id, entity_type: 'busy', ...where },
        order: [['event_id', 'ASC']],
    });
const tokensOf = async (user) =>
    JSON.parse(
        (await LtdGcalAccount.findOne({ where: { user_id: user.id } }))
            .sync_token || '{}'
    );
async function login(user) {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' })
        .expect(200);
    return agent;
}

beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
});
afterAll(() => nock.enableNetConnect());
beforeEach(() => {
    // Only Date is faked: Google fixtures stay "in the future" forever.
    jest.useFakeTimers({
        now: new Date('2026-01-01T06:00:00Z'),
        doNotFake: [
            'nextTick',
            'setImmediate',
            'clearImmediate',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'queueMicrotask',
            'hrtime',
            'performance',
        ],
    });
});
afterEach(() => {
    const pending = nock.pendingMocks();
    nock.cleanAll();
    jest.useRealTimers();
    // Every recorded Google answer must have been asked for.
    if (pending.length) throw new Error(`Unused fixtures: ${pending}`);
});

describe('OAuth connect', () => {
    it('asks only read scopes plus app-created calendars, with state and PKCE', async () => {
        const user = await makeUser();
        const agent = await login(user);
        const res = await agent.post('/api/ltd/gcal/connect').expect(200);
        const url = new URL(res.body.url);
        const scopes = url.searchParams.get('scope').split(' ');
        expect(scopes).toEqual([
            'openid',
            'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
            'https://www.googleapis.com/auth/calendar.events.readonly',
            'https://www.googleapis.com/auth/calendar.app.created',
        ]);
        expect(scopes).not.toContain(
            'https://www.googleapis.com/auth/calendar'
        );
        expect(scopes).not.toContain(
            'https://www.googleapis.com/auth/calendar.events'
        );
        expect(url.searchParams.get('redirect_uri')).toBe(
            process.env.GOOGLE_CALENDAR_REDIRECT_URI
        );
        expect(url.searchParams.get('state')).toHaveLength(43);
        expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('rejects a wrong or replayed state without calling Google', async () => {
        const user = await makeUser();
        const agent = await login(user);
        await agent.post('/api/ltd/gcal/connect').expect(200);
        // A token endpoint that would succeed must stay untouched.
        const token = nock(OAUTH)
            .post('/token')
            .reply(200, {
                refresh_token: REFRESH,
                scope: google.SCOPES.join(' '),
            });
        const bad = await agent
            .get('/api/ltd/gcal/callback?state=forged&code=c')
            .expect(302);
        expect(bad.headers.location).toBe(
            '/profile?section=calendars&gcal=error'
        );
        expect(token.isDone()).toBe(false);
        expect(await LtdGcalAccount.count()).toBe(0);
        nock.cleanAll();
    });

    it('stores the refresh token encrypted, never returns it, and does not accept the state twice', async () => {
        const user = await makeUser();
        const agent = await login(user);
        const start = await agent.post('/api/ltd/gcal/connect').expect(200);
        const url = new URL(start.body.url);
        const state = url.searchParams.get('state');
        const challenge = url.searchParams.get('code_challenge');
        nock(OAUTH)
            .post('/token', (b) => {
                const body = form(b);
                const verifier = body.code_verifier;
                return (
                    body.grant_type === 'authorization_code' &&
                    body.code === 'fixture-code' &&
                    body.redirect_uri ===
                        process.env.GOOGLE_CALENDAR_REDIRECT_URI &&
                    crypto
                        .createHash('sha256')
                        .update(verifier)
                        .digest('base64url') === challenge
                );
            })
            .reply(200, {
                access_token: 'fixture-access',
                refresh_token: REFRESH,
                scope: google.SCOPES.join(' '),
                id_token: `x.${Buffer.from(JSON.stringify({ sub: 'g-123' })).toString('base64url')}.y`,
            });
        // The first sync starts in the background after the callback.
        refreshOk();
        calendarList([{ id: ME, primary: true, selected: true }]);
        listEvents(ME, (q) => !q.syncToken, {
            items: [timed('a', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z')],
            nextSyncToken: 'sync-1',
        });

        const done = await agent
            .get(`/api/ltd/gcal/callback?state=${state}&code=fixture-code`)
            .expect(302);
        expect(done.headers.location).toBe(
            '/profile?section=calendars&gcal=connected'
        );
        const account = await LtdGcalAccount.findOne({
            where: { user_id: user.id },
        });
        expect(account.google_sub).toBe('g-123');
        expect(account.refresh_token_enc).not.toContain(REFRESH);
        expect(secretCipher.decrypt(account.refresh_token_enc)).toBe(REFRESH);

        for (let i = 0; i < 100 && !nock.isDone(); i++) {
            await new Promise((r) => setTimeout(r, 20));
        }
        for (let i = 0; i < 100; i++) {
            if ((await account.reload()).last_sync_at) break;
            await new Promise((r) => setTimeout(r, 20));
        }
        expect(account.last_sync_at).not.toBeNull();

        const status = await agent.get('/api/ltd/gcal').expect(200);
        expect(status.body).toMatchObject({
            connected: true,
            status: 'active',
        });
        expect(JSON.stringify(status.body)).not.toMatch(
            /refresh|fixture-access|enc:v1/
        );

        const replay = await agent
            .get(`/api/ltd/gcal/callback?state=${state}&code=fixture-code`)
            .expect(302);
        expect(replay.headers.location).toContain('gcal=error');
    });

    it('refuses Bearer tokens on the management routes', async () => {
        await request(app)
            .get('/api/ltd/gcal')
            .set('Authorization', 'Bearer tt_nope')
            .expect((res) => expect([401, 403]).toContain(res.status));
    });
});

describe('read sync', () => {
    it('full sync pages and keeps nextSyncToken only from the last page', async () => {
        const user = await makeUser();
        await connect(user);
        refreshOk();
        calendarList([
            { id: ME, primary: true, selected: true },
            { id: 'hidden@group.calendar.google.com', selected: false },
        ]);
        listEvents(ME, (q) => !q.syncToken && !q.pageToken && !q.timeMin, {
            items: [timed('a', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z')],
            nextPageToken: 'page-2',
        });
        listEvents(ME, (q) => q.pageToken === 'page-2' && !q.syncToken, {
            items: [timed('b', '2026-01-06T10:00:00Z', '2026-01-06T11:00:00Z')],
            nextSyncToken: 'sync-1',
        });
        await gcal.syncUser(user.id);
        expect((await links(user)).map((l) => l.event_id)).toEqual(['a', 'b']);
        expect(await tokensOf(user)).toEqual({ [ME]: 'sync-1' });
    });

    it('stores no token when a later page fails', async () => {
        const user = await makeUser();
        await connect(user);
        refreshOk();
        calendarList([{ id: ME, selected: true }]);
        listEvents(ME, (q) => !q.pageToken, {
            items: [timed('a', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z')],
            nextPageToken: 'page-2',
        });
        listEvents(ME, (q) => q.pageToken === 'page-2', {}, 500);
        await gcal.syncUser(user.id);
        const account = await LtdGcalAccount.findOne({
            where: { user_id: user.id },
        });
        expect(account.sync_token).toBeNull();
        expect(account.last_error).toMatch(/500/);
    });

    it('incremental sync sends only the sync token and applies deletions', async () => {
        const user = await makeUser();
        await connect(user, { sync_token: JSON.stringify({ [ME]: 'sync-1' }) });
        await LtdExternalEventLink.create({
            user_id: user.id,
            calendar_id: ME,
            event_id: 'a',
            entity_type: 'busy',
            start_at: new Date('2026-01-05T10:00:00Z'),
            end_at: new Date('2026-01-05T11:00:00Z'),
        });
        refreshOk();
        calendarList([{ id: ME, selected: true }]);
        listEvents(
            ME,
            (q) =>
                q.syncToken === 'sync-1' &&
                !q.timeMin &&
                !q.timeMax &&
                !q.updatedMin &&
                !q.orderBy,
            {
                items: [
                    { id: 'a', status: 'cancelled' },
                    timed('c', '2026-01-07T09:00:00Z', '2026-01-07T09:30:00Z'),
                ],
                nextSyncToken: 'sync-2',
            }
        );
        await gcal.syncUser(user.id);
        expect((await links(user)).map((l) => l.event_id)).toEqual(['c']);
        expect(await tokensOf(user)).toEqual({ [ME]: 'sync-2' });
    });

    it('410 Gone clears the read model and runs a full sync again', async () => {
        const user = await makeUser();
        await connect(user, { sync_token: JSON.stringify({ [ME]: 'stale' }) });
        await LtdExternalEventLink.create({
            user_id: user.id,
            calendar_id: ME,
            event_id: 'old',
            entity_type: 'busy',
            start_at: new Date('2026-01-05T10:00:00Z'),
            end_at: new Date('2026-01-05T11:00:00Z'),
        });
        refreshOk();
        calendarList([{ id: ME, selected: true }]);
        listEvents(
            ME,
            (q) => q.syncToken === 'stale',
            { error: { code: 410 } },
            410
        );
        listEvents(ME, (q) => !q.syncToken, {
            items: [
                timed('fresh', '2026-01-08T09:00:00Z', '2026-01-08T10:00:00Z'),
            ],
            nextSyncToken: 'sync-new',
        });
        await gcal.syncUser(user.id);
        expect((await links(user)).map((l) => l.event_id)).toEqual(['fresh']);
        expect(await tokensOf(user)).toEqual({ [ME]: 'sync-new' });
    });

    it('never imports Life-to-Day blocks, free time, declined invites or its own calendar', async () => {
        const user = await makeUser();
        await connect(user, { target_calendar_id: LTD });
        refreshOk();
        calendarList([
            { id: ME, selected: true },
            { id: LTD, selected: true },
        ]);
        listEvents(ME, () => true, {
            items: [
                timed('ltd', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z', {
                    extendedProperties: {
                        private: { ltd_uid: '2026-01-05:t1' },
                    },
                }),
                timed('free', '2026-01-05T12:00:00Z', '2026-01-05T13:00:00Z', {
                    transparency: 'transparent',
                }),
                timed(
                    'declined',
                    '2026-01-05T14:00:00Z',
                    '2026-01-05T15:00:00Z',
                    {
                        attendees: [{ self: true, responseStatus: 'declined' }],
                    }
                ),
                timed('real', '2026-01-05T16:00:00Z', '2026-01-05T17:00:00Z'),
            ],
            nextSyncToken: 's',
        });
        // Export after sync: today's plan is empty, so nothing is written.
        await gcal.syncUser(user.id);
        expect((await links(user)).map((l) => l.event_id)).toEqual(['real']);
        expect(await tokensOf(user)).toEqual({ [ME]: 's' });
    });

    it('marks the account revoked on invalid_grant so the planner falls back to iCal', async () => {
        const user = await makeUser();
        await connect(user);
        nock(OAUTH).post('/token').reply(400, { error: 'invalid_grant' });
        await gcal.syncUser(user.id);
        expect(
            (await LtdGcalAccount.findOne({ where: { user_id: user.id } }))
                .status
        ).toBe('revoked');
        expect(await busy.activeAccount(user.id)).toBeNull();
    });
});

describe('busy time in the planner (T-902)', () => {
    async function syncWith(user, items) {
        refreshOk();
        calendarList([{ id: ME, selected: true }]);
        listEvents(ME, () => true, { items, nextSyncToken: 's' });
        await gcal.syncUser(user.id);
    }

    it.each([
        // Spring forward in Paris: 10:00 local is still minute 600.
        [
            'Europe/Paris',
            '2026-03-29',
            '2026-03-29T08:00:00Z',
            '2026-03-29T09:00:00Z',
        ],
        [
            'America/New_York',
            '2026-03-08',
            '2026-03-08T14:00:00Z',
            '2026-03-08T15:00:00Z',
        ],
        [
            'America/New_York',
            '2026-11-01',
            '2026-11-01T15:00:00Z',
            '2026-11-01T16:00:00Z',
        ],
        // Tehran has no DST after 2022: +03:30 in June 2026, no hour slip.
        [
            'Asia/Tehran',
            '2026-06-15',
            '2026-06-15T06:30:00Z',
            '2026-06-15T07:30:00Z',
        ],
    ])('%s %s: 10:00 local is minute 600', async (tz, day, start, end) => {
        const user = await makeUser(tz);
        await connect(user);
        await syncWith(user, [timed('e', start, end)]);
        const { events } = await busy.eventsForDay(user, day);
        expect(events).toEqual([
            expect.objectContaining({
                all_day: false,
                busy: true,
                start_minute: 600,
                end_minute: 660,
            }),
        ]);
        const capacity = await planner.getCapacity(user, day);
        expect(capacity.busy_minutes).toBe(60);
    });

    it('stores instants as UTC plus the IANA zone and all-day as a date only', async () => {
        const user = await makeUser('Europe/Paris');
        await connect(user);
        await syncWith(user, [
            {
                ...timed(
                    't',
                    '2026-03-10T10:00:00+01:00',
                    '2026-03-10T11:00:00+01:00'
                ),
                start: {
                    dateTime: '2026-03-10T10:00:00+01:00',
                    timeZone: 'Europe/Paris',
                },
            },
            {
                id: 'holiday',
                status: 'confirmed',
                start: { date: '2026-03-10' },
                end: { date: '2026-03-11' },
            },
        ]);
        const [holiday, t] = await links(user);
        expect(t.start_at.toISOString()).toBe('2026-03-10T09:00:00.000Z');
        expect(t.time_zone).toBe('Europe/Paris');
        expect(holiday.start_at).toBeNull();
        expect(holiday.start_date).toBe('2026-03-10');
        expect(holiday.end_date).toBe('2026-03-11');
    });

    it('an all-day event does not zero hourly capacity', async () => {
        const user = await makeUser();
        await connect(user);
        await syncWith(user, [
            {
                id: 'day',
                status: 'confirmed',
                start: { date: '2026-03-10' },
                end: { date: '2026-03-11' },
            },
            timed('m', '2026-03-10T09:00:00Z', '2026-03-10T10:00:00Z'),
        ]);
        const capacity = await planner.getCapacity(user, '2026-03-10');
        expect(capacity.busy_minutes).toBe(60);
        expect(capacity.capacity_minutes).toBe(420);
    });

    it('with Google connected the iCal feed is not added again; after disconnect iCal is back', async () => {
        const user = await makeUser();
        const feed = jest
            .spyOn(calendarFeeds, 'eventsForDay')
            .mockResolvedValue({
                date: '2026-03-10',
                events: [
                    {
                        all_day: false,
                        busy: true,
                        title: 'ical',
                        start_minute: 600,
                        end_minute: 630,
                    },
                ],
                errors: [],
            });
        await connect(user);
        await syncWith(user, [
            timed('g', '2026-03-10T09:00:00Z', '2026-03-10T10:30:00Z'),
        ]);
        expect(
            (await planner.getCapacity(user, '2026-03-10')).busy_minutes
        ).toBe(90);
        expect(feed).not.toHaveBeenCalled();

        nock(OAUTH).post('/revoke').reply(200, {});
        const agent = await login(user);
        const res = await agent.post('/api/ltd/gcal/disconnect').expect(200);
        expect(res.body).toEqual({ disconnected: true, revoked: true });
        expect(
            (await planner.getCapacity(user, '2026-03-10')).busy_minutes
        ).toBe(30);
        expect(feed).toHaveBeenCalled();
    });

    it('Google busy carries no title, so the AI context never gets one', async () => {
        const user = await makeUser();
        await connect(user);
        await syncWith(user, [
            timed('g', '2026-03-10T09:00:00Z', '2026-03-10T10:00:00Z'),
        ]);
        const { events } = await busy.eventsForDay(user, '2026-03-10');
        expect(events[0]).not.toHaveProperty('title');
    });

    it('user A never sees user B busy time, account or tokens', async () => {
        const a = await makeUser();
        const b = await makeUser();
        await connect(b);
        await syncWith(b, [
            timed('secret-b', '2026-03-10T09:00:00Z', '2026-03-10T12:00:00Z'),
        ]);
        expect((await busy.eventsForDay(a, '2026-03-10')).events).toEqual([]);
        const agentA = await login(a);
        const status = await agentA.get('/api/ltd/gcal').expect(200);
        expect(status.body.connected).toBe(false);
        await agentA.post('/api/ltd/gcal/disconnect').expect(200);
        expect(await LtdGcalAccount.count({ where: { user_id: b.id } })).toBe(
            1
        );
        expect(await links(b)).toHaveLength(1);
    });
});

describe('disconnect', () => {
    it('clears the local secret, sync tokens and links even when revoke fails, and says so', async () => {
        const user = await makeUser();
        await connect(user, { sync_token: JSON.stringify({ [ME]: 's' }) });
        await LtdExternalEventLink.create({
            user_id: user.id,
            calendar_id: ME,
            event_id: 'x',
            entity_type: 'busy',
        });
        nock(OAUTH)
            .post('/revoke', (b) => form(b).token === REFRESH)
            .reply(400, { error: 'invalid_token' });
        const agent = await login(user);
        const res = await agent.post('/api/ltd/gcal/disconnect').expect(200);
        expect(res.body.revoked).toBe(false);
        expect(res.body.message).toMatch(/Google did not confirm/);
        expect(
            await LtdGcalAccount.count({ where: { user_id: user.id } })
        ).toBe(0);
        expect(
            await LtdExternalEventLink.count({ where: { user_id: user.id } })
        ).toBe(0);
    });
});

describe('writing only to the Life-to-Day calendar (T-903)', () => {
    it('refuses primary, a foreign id or a missing target before any fetch', () => {
        const fetchSpy = jest.spyOn(global, 'fetch');
        const account = { target_calendar_id: LTD };
        for (const id of ['primary', ME, TEAM, '', undefined, `${LTD}x`]) {
            expect(() => google.insertEvent('t', account, id, {})).toThrow(
                /outside the Life-to-Day calendar/
            );
            expect(() =>
                google.updateEvent('t', account, id, 'e', {})
            ).toThrow();
            expect(() => google.deleteEvent('t', account, id, 'e')).toThrow();
            expect(() => google.deleteCalendar('t', account, id)).toThrow();
        }
        expect(() =>
            google.insertEvent('t', { target_calendar_id: null }, 'primary', {})
        ).toThrow();
        expect(() =>
            google.insertEvent(
                't',
                { target_calendar_id: 'primary' },
                'primary',
                {}
            )
        ).toThrow();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('creates its own calendar, upserts blocks there only, skips unchanged and overwrites changed ones', async () => {
        const user = await makeUser();
        await connect(user);
        const task = await Task.create({
            name: 'Write the report',
            user_id: user.id,
        });
        await dailyPlan.replaceItems(user, '2026-01-01', [
            { task_uid: task.uid, start_minute: 600, duration_minutes: 60 },
        ]);

        const writes = [];
        const api = nock(API);
        api.on('request', (req) => {
            if (req.method !== 'GET') writes.push(`${req.method} ${req.path}`);
        });
        refreshOk();
        api.post(
            '/calendar/v3/calendars',
            (b) => b.summary === 'Life-to-Day'
        ).reply(200, { id: LTD });
        api.post(
            eventsPath(LTD),
            (b) =>
                b.extendedProperties.private.ltd_uid ===
                    `2026-01-01:${task.uid}` &&
                b.start.dateTime === '2026-01-01T10:00:00Z' &&
                b.summary === 'Write the report'
        ).reply(200, { id: 'x', etag: '"1"' });
        const status = await gcal.setExport(user, true);
        expect(status.export_enabled).toBe(true);

        const account = await LtdGcalAccount.findOne({
            where: { user_id: user.id },
        });
        await gcal.exportBlocks(user, account, 'fixture-access');

        await dailyPlan.replaceItems(user, '2026-01-01', [
            { task_uid: task.uid, start_minute: 660, duration_minutes: 60 },
        ]);
        api.put(
            (p) => p.startsWith(`${eventsPath(LTD)}/`),
            (b) => b.start.dateTime === '2026-01-01T11:00:00Z'
        ).reply(200, { etag: '"2"' });
        await gcal.exportBlocks(user, account, 'fixture-access');

        expect(writes).toHaveLength(3);
        for (const w of writes) {
            expect(
                w === 'POST /calendar/v3/calendars' ||
                    w.includes(eventsPath(LTD))
            ).toBe(true);
            expect(w).not.toMatch(/primary|me%40example|team%40group/);
        }
        const block = await LtdExternalEventLink.findOne({
            where: { entity_type: 'block' },
        });
        expect(block.etag).toBe('"2"');
    });
});

describe('worker', () => {
    it('polls every 10 minutes, and one run with a fake clock syncs every active account once', async () => {
        expect(scheduler._getCronExpression('gcal_sync')).toBe('*/10 * * * *');
        const now = new Date('2026-02-02T08:10:00Z');
        jest.setSystemTime(now);
        const user = await makeUser();
        await connect(user);
        const other = await makeUser();
        await connect(other, { status: 'revoked' });
        refreshOk();
        calendarList([{ id: ME, selected: true }]);
        listEvents(ME, () => true, { items: [], nextSyncToken: 's' });
        await scheduler._createJobHandler('gcal_sync')();
        const synced = await LtdGcalAccount.findOne({
            where: { user_id: user.id },
        });
        expect(synced.last_sync_at.toISOString()).toBe(now.toISOString());
        const skipped = await LtdGcalAccount.findOne({
            where: { user_id: other.id },
        });
        expect(skipped.last_sync_at).toBeNull();
    });
});
