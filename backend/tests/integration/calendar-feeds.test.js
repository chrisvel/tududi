jest.mock('../../modules/calendar-feeds/fetcher', () => {
    const actual = jest.requireActual('../../modules/calendar-feeds/fetcher');
    return { ...actual, fetchFeed: jest.fn() };
});

const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { CalendarFeed } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    fetchFeed,
    FeedFetchError,
} = require('../../modules/calendar-feeds/fetcher');
const calendarFeedsService = require('../../modules/calendar-feeds/service');

const SECRET_URL =
    'https://calendar.google.com/calendar/ical/me%40example.com/private-abc123/basic.ics';

function icsFor(date) {
    const compact = date.replace(/-/g, '');
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//test//EN',
        'BEGIN:VEVENT',
        'UID:dentist@test',
        `DTSTART;TZID=Europe/Athens:${compact}T160000`,
        `DTEND;TZID=Europe/Athens:${compact}T170000`,
        'SUMMARY:Dentist',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}

describe('Calendar feed routes', () => {
    let agent, today, previousSecret;

    beforeAll(() => {
        previousSecret = process.env.TUDUDI_SESSION_SECRET;
        process.env.TUDUDI_SESSION_SECRET = 'calendar-feed-test-secret';
    });

    afterAll(() => {
        if (previousSecret === undefined) {
            delete process.env.TUDUDI_SESSION_SECRET;
        } else {
            process.env.TUDUDI_SESSION_SECRET = previousSecret;
        }
    });

    beforeEach(async () => {
        calendarFeedsService.clearCache();
        fetchFeed.mockReset();
        today = moment.tz('Europe/Athens').format('YYYY-MM-DD');
        fetchFeed.mockResolvedValue(icsFor(today));

        await createTestUser({
            email: 'feeds@example.com',
            timezone: 'Europe/Athens',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'feeds@example.com',
            password: 'password123',
        });
    });

    it('adds a feed without ever returning the secret address', async () => {
        const res = await agent
            .post('/api/calendar-feeds')
            .send({ name: 'Google', url: SECRET_URL, color: '#2563eb' });

        expect(res.status).toBe(201);
        expect(res.body.feed.url_host).toBe('calendar.google.com');
        expect(JSON.stringify(res.body)).not.toContain('private-abc123');

        const stored = await CalendarFeed.findOne();
        expect(stored.url_encrypted.startsWith('enc:v1:')).toBe(true);

        const list = await agent.get('/api/calendar-feeds');
        expect(JSON.stringify(list.body)).not.toContain('private-abc123');
    });

    it('accepts webcal links as https', async () => {
        const res = await agent.post('/api/calendar-feeds').send({
            name: 'Apple',
            url: SECRET_URL.replace('https://', 'webcal://'),
        });

        expect(res.status).toBe(201);
        expect(fetchFeed).toHaveBeenCalledWith(SECRET_URL);
    });

    it('refuses a feed that cannot be read and saves nothing', async () => {
        fetchFeed.mockRejectedValue(
            new FeedFetchError(
                'That address points to a private or unsupported host'
            )
        );

        const res = await agent
            .post('/api/calendar-feeds')
            .send({ name: 'Local', url: 'http://127.0.0.1/cal.ics' });

        expect(res.status).toBe(400);
        expect(res.body.error || res.body.message).toMatch(/private/);
        expect(await CalendarFeed.count()).toBe(0);
    });

    it("returns the day's events in the user's timezone", async () => {
        await agent
            .post('/api/calendar-feeds')
            .send({ name: 'Google', url: SECRET_URL });

        const res = await agent.get(`/api/calendar-feeds/events?date=${today}`);

        expect(res.status).toBe(200);
        expect(res.body.errors).toEqual([]);
        expect(res.body.events).toHaveLength(1);
        expect(res.body.events[0]).toMatchObject({
            title: 'Dentist',
            start_minute: 16 * 60,
            end_minute: 17 * 60,
            feed_name: 'Google',
        });
    });

    it('returns the events of a date range', async () => {
        await agent
            .post('/api/calendar-feeds')
            .send({ name: 'Google', url: SECRET_URL });

        const res = await agent.get(
            `/api/calendar-feeds/events?from=${today}&to=${today}`
        );

        expect(res.status).toBe(200);
        expect(res.body.errors).toEqual([]);
        expect(res.body.events).toHaveLength(1);
        expect(res.body.events[0]).toMatchObject({
            title: 'Dentist',
            feed_name: 'Google',
        });
    });

    it('refuses a range that is too long or backwards', async () => {
        const tooLong = await agent.get(
            '/api/calendar-feeds/events?from=2026-01-01&to=2026-06-01'
        );
        const backwards = await agent.get(
            '/api/calendar-feeds/events?from=2026-09-10&to=2026-09-01'
        );

        expect(tooLong.status).toBe(400);
        expect(backwards.status).toBe(400);
    });

    it('reports a feed that stopped working instead of failing the day', async () => {
        await agent
            .post('/api/calendar-feeds')
            .send({ name: 'Google', url: SECRET_URL });
        calendarFeedsService.clearCache();
        fetchFeed.mockRejectedValue(
            new FeedFetchError('Could not reach the calendar')
        );

        const res = await agent.get(`/api/calendar-feeds/events?date=${today}`);

        expect(res.status).toBe(200);
        expect(res.body.events).toEqual([]);
        expect(res.body.errors[0].message).toBe('Could not reach the calendar');
        const stored = await CalendarFeed.findOne();
        expect(stored.last_error).toBe('Could not reach the calendar');
    });

    it('does not let another user remove a feed', async () => {
        const created = await agent
            .post('/api/calendar-feeds')
            .send({ name: 'Google', url: SECRET_URL });

        await createTestUser({ email: 'feeds-other@example.com' });
        const other = request.agent(app);
        await other.post('/api/login').send({
            email: 'feeds-other@example.com',
            password: 'password123',
        });

        const res = await other.delete(
            `/api/calendar-feeds/${created.body.feed.uid}`
        );

        expect(res.status).toBe(404);
        expect(await CalendarFeed.count()).toBe(1);
    });
});
