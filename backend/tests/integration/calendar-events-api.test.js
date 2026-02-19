const request = require('supertest');
const app = require('../../app');
const { CalendarEvent } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const moment = require('moment-timezone');

describe('Calendar Events API', () => {
    let user;
    let agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'calendar@example.com',
            timezone: 'America/New_York',
            language: 'en',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'calendar@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/calendar/events', () => {
        describe('today type', () => {
            it('should return events for today', async () => {
                const timezone = 'America/New_York';
                const todayStart = moment.tz(timezone).startOf('day').utc();
                const todayEnd = moment.tz(timezone).endOf('day').utc();

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'today@example.com',
                    title: 'Today Event',
                    starts_at: todayStart.add(10, 'hours').toDate(),
                    ends_at: todayStart.add(11, 'hours').toDate(),
                    all_day: false,
                });

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'tomorrow@example.com',
                    title: 'Tomorrow Event',
                    starts_at: todayEnd.add(10, 'hours').toDate(),
                    ends_at: todayEnd.add(11, 'hours').toDate(),
                    all_day: false,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=today'
                );

                expect(response.status).toBe(200);
                expect(response.body.events).toBeDefined();
                expect(response.body.events.length).toBeGreaterThan(0);
                expect(
                    response.body.events.some((e) => e.title === 'Today Event')
                ).toBe(true);
                expect(
                    response.body.events.some(
                        (e) => e.title === 'Tomorrow Event'
                    )
                ).toBe(false);
            });

            it('should group events by day when groupBy=day', async () => {
                const timezone = 'America/New_York';
                const todayStart = moment.tz(timezone).startOf('day').utc();

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'event1@example.com',
                    title: 'Event 1',
                    starts_at: todayStart.add(10, 'hours').toDate(),
                    ends_at: todayStart.add(11, 'hours').toDate(),
                    all_day: false,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=today&groupBy=day'
                );

                expect(response.status).toBe(200);
                expect(response.body.groupedEvents).toBeDefined();
                expect(typeof response.body.groupedEvents).toBe('object');
                expect(
                    Object.keys(response.body.groupedEvents).length
                ).toBeGreaterThan(0);
            });
        });

        describe('upcoming type', () => {
            it('should return upcoming events with default maxDays=7', async () => {
                const timezone = 'America/New_York';
                const now = moment.tz(timezone);

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'day3@example.com',
                    title: 'Day 3 Event',
                    starts_at: now
                        .clone()
                        .add(3, 'days')
                        .hour(10)
                        .minute(0)
                        .utc()
                        .toDate(),
                    ends_at: now
                        .clone()
                        .add(3, 'days')
                        .hour(11)
                        .minute(0)
                        .utc()
                        .toDate(),
                    all_day: false,
                });

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'day10@example.com',
                    title: 'Day 10 Event',
                    starts_at: now
                        .clone()
                        .add(10, 'days')
                        .hour(10)
                        .minute(0)
                        .utc()
                        .toDate(),
                    ends_at: now
                        .clone()
                        .add(10, 'days')
                        .hour(11)
                        .minute(0)
                        .utc()
                        .toDate(),
                    all_day: false,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=upcoming'
                );

                expect(response.status).toBe(200);
                expect(
                    response.body.events.some((e) => e.title === 'Day 3 Event')
                ).toBe(true);
                expect(
                    response.body.events.some((e) => e.title === 'Day 10 Event')
                ).toBe(false);
            });

            it('should respect custom maxDays parameter', async () => {
                const timezone = 'America/New_York';
                const now = moment.tz(timezone);

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'day5@example.com',
                    title: 'Day 5 Event',
                    starts_at: now
                        .clone()
                        .add(5, 'days')
                        .hour(10)
                        .minute(0)
                        .utc()
                        .toDate(),
                    ends_at: now
                        .clone()
                        .add(5, 'days')
                        .hour(11)
                        .minute(0)
                        .utc()
                        .toDate(),
                    all_day: false,
                });

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'day20@example.com',
                    title: 'Day 20 Event',
                    starts_at: now
                        .clone()
                        .add(20, 'days')
                        .hour(10)
                        .minute(0)
                        .utc()
                        .toDate(),
                    ends_at: now
                        .clone()
                        .add(20, 'days')
                        .hour(11)
                        .minute(0)
                        .utc()
                        .toDate(),
                    all_day: false,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&maxDays=14'
                );

                expect(response.status).toBe(200);
                expect(
                    response.body.events.some((e) => e.title === 'Day 5 Event')
                ).toBe(true);
                expect(
                    response.body.events.some((e) => e.title === 'Day 20 Event')
                ).toBe(false);
            });
        });

        describe('groupBy=day bucketing', () => {
            beforeEach(async () => {
                const timezone = 'America/New_York';
                const today = moment.tz(timezone).startOf('day');

                await CalendarEvent.bulkCreate([
                    {
                        user_id: user.id,
                        source: 'ics',
                        ical_uid: 'event1@example.com',
                        title: 'Event 1',
                        starts_at: today
                            .clone()
                            .hour(10)
                            .minute(0)
                            .utc()
                            .toDate(),
                        ends_at: today
                            .clone()
                            .hour(11)
                            .minute(0)
                            .utc()
                            .toDate(),
                        all_day: false,
                    },
                    {
                        user_id: user.id,
                        source: 'ics',
                        ical_uid: 'event2@example.com',
                        title: 'Event 2',
                        starts_at: today
                            .clone()
                            .hour(14)
                            .minute(0)
                            .utc()
                            .toDate(),
                        ends_at: today
                            .clone()
                            .hour(15)
                            .minute(0)
                            .utc()
                            .toDate(),
                        all_day: false,
                    },
                    {
                        user_id: user.id,
                        source: 'ics',
                        ical_uid: 'event3@example.com',
                        title: 'Event 3',
                        starts_at: today
                            .clone()
                            .add(1, 'day')
                            .hour(10)
                            .minute(0)
                            .utc()
                            .toDate(),
                        ends_at: today
                            .clone()
                            .add(1, 'day')
                            .hour(11)
                            .minute(0)
                            .utc()
                            .toDate(),
                        all_day: false,
                    },
                ]);
            });

            it('should group events by day', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&groupBy=day'
                );

                expect(response.status).toBe(200);
                expect(response.body.groupedEvents).toBeDefined();

                const groups = Object.keys(response.body.groupedEvents);
                expect(groups.length).toBeGreaterThan(0);

                const firstDayEvents = response.body.groupedEvents[groups[0]];
                expect(Array.isArray(firstDayEvents)).toBe(true);
                expect(firstDayEvents.length).toBeGreaterThan(0);
            });

            it('should create separate buckets for different days', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&groupBy=day&maxDays=7'
                );

                expect(response.status).toBe(200);

                const groups = Object.keys(response.body.groupedEvents);
                expect(groups.length).toBeGreaterThanOrEqual(2);
            });

            it('should include multiple events in same day bucket', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=today&groupBy=day'
                );

                expect(response.status).toBe(200);

                const groups = Object.keys(response.body.groupedEvents);
                if (groups.length > 0) {
                    const todayBucket = response.body.groupedEvents[groups[0]];
                    expect(todayBucket.length).toBeGreaterThanOrEqual(2);
                }
            });

            it('should sort events within each bucket', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=today&groupBy=day'
                );

                expect(response.status).toBe(200);

                const groups = Object.keys(response.body.groupedEvents);
                if (groups.length > 0) {
                    const todayBucket = response.body.groupedEvents[groups[0]];
                    if (todayBucket.length > 1) {
                        const times = todayBucket.map((e) =>
                            new Date(e.starts_at).getTime()
                        );
                        const sortedTimes = [...times].sort((a, b) => a - b);
                        expect(times).toEqual(sortedTimes);
                    }
                }
            });
        });

        describe('multi-day event expansion', () => {
            it('should expand multi-day event across dates', async () => {
                const timezone = 'America/New_York';
                const today = moment.tz(timezone).startOf('day');

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'multiday@example.com',
                    title: 'Multi-Day Event',
                    starts_at: today.clone().utc().toDate(),
                    ends_at: today.clone().add(2, 'days').utc().toDate(),
                    all_day: true,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&groupBy=day&maxDays=7'
                );

                expect(response.status).toBe(200);

                const allEvents = response.body.events.filter(
                    (e) => e.title === 'Multi-Day Event'
                );

                expect(allEvents.length).toBeGreaterThanOrEqual(3);

                const uniqueDates = new Set(
                    allEvents.map((e) => e.occurrence_date)
                );
                expect(uniqueDates.size).toBeGreaterThanOrEqual(3);
            });

            it('should include occurrence_date for expanded events', async () => {
                const timezone = 'America/New_York';
                const today = moment.tz(timezone).startOf('day');

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'conference@example.com',
                    title: 'Conference',
                    starts_at: today.clone().utc().toDate(),
                    ends_at: today.clone().add(1, 'days').utc().toDate(),
                    all_day: true,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&maxDays=7'
                );

                expect(response.status).toBe(200);

                const conferenceEvents = response.body.events.filter(
                    (e) => e.title === 'Conference'
                );

                conferenceEvents.forEach((event) => {
                    expect(event.occurrence_date).toBeDefined();
                    expect(event.occurrence_date).toMatch(
                        /^\d{4}-\d{2}-\d{2}$/
                    );
                });
            });
        });

        describe('validation', () => {
            it('should reject invalid type parameter', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=invalid'
                );

                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Invalid type');
            });

            it('should reject negative maxDays', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&maxDays=-5'
                );

                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Invalid maxDays');
            });

            it('should reject zero maxDays', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&maxDays=0'
                );

                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Invalid maxDays');
            });

            it('should reject non-numeric maxDays', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=upcoming&maxDays=abc'
                );

                expect(response.status).toBe(400);
                expect(response.body.error).toContain('Invalid maxDays');
            });

            it('should require authentication', async () => {
                const response = await request(app).get(
                    '/api/calendar/events?type=today'
                );

                expect(response.status).toBe(401);
            });
        });

        describe('timezone handling', () => {
            it('should respect user timezone for today query', async () => {
                const userTz = 'America/New_York';
                const todayStart = moment
                    .tz(userTz)
                    .startOf('day')
                    .utc()
                    .toDate();

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'tz-test@example.com',
                    title: 'Timezone Test',
                    starts_at: todayStart,
                    ends_at: moment(todayStart).add(1, 'hour').toDate(),
                    all_day: false,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=today'
                );

                expect(response.status).toBe(200);
                expect(
                    response.body.events.some(
                        (e) => e.title === 'Timezone Test'
                    )
                ).toBe(true);
            });

            it('should handle UTC timezone', async () => {
                const utcUser = await createTestUser({
                    email: 'utc@example.com',
                    timezone: 'UTC',
                });

                const utcAgent = request.agent(app);
                await utcAgent.post('/api/login').send({
                    email: 'utc@example.com',
                    password: 'password123',
                });

                const todayStart = moment.utc().startOf('day').toDate();

                await CalendarEvent.create({
                    user_id: utcUser.id,
                    source: 'ics',
                    ical_uid: 'utc-event@example.com',
                    title: 'UTC Event',
                    starts_at: todayStart,
                    ends_at: moment(todayStart).add(1, 'hour').toDate(),
                    all_day: false,
                });

                const response = await utcAgent.get(
                    '/api/calendar/events?type=today'
                );

                expect(response.status).toBe(200);
                expect(
                    response.body.events.some((e) => e.title === 'UTC Event')
                ).toBe(true);
            });
        });

        describe('all-day events', () => {
            it('should handle all-day events', async () => {
                const timezone = 'America/New_York';
                const today = moment.tz(timezone).startOf('day');

                await CalendarEvent.create({
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'allday@example.com',
                    title: 'All Day Event',
                    starts_at: today.clone().utc().toDate(),
                    ends_at: today.clone().endOf('day').utc().toDate(),
                    all_day: true,
                });

                const response = await agent.get(
                    '/api/calendar/events?type=today'
                );

                expect(response.status).toBe(200);

                const allDayEvent = response.body.events.find(
                    (e) => e.title === 'All Day Event'
                );

                expect(allDayEvent).toBeDefined();
                expect(allDayEvent.all_day).toBe(true);
            });
        });

        describe('empty results', () => {
            it('should return empty arrays when no events exist', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=today'
                );

                expect(response.status).toBe(200);
                expect(response.body.events).toEqual([]);
            });

            it('should return empty grouped object when no events and groupBy=day', async () => {
                const response = await agent.get(
                    '/api/calendar/events?type=today&groupBy=day'
                );

                expect(response.status).toBe(200);
                expect(response.body.groupedEvents).toEqual({});
            });
        });
    });
});
