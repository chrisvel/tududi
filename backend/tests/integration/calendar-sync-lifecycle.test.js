const request = require('supertest');
const app = require('../../app');
const { User, CalendarEvent } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const icsFetcher = require('../../modules/calendar/icsFetcher');
const icsParser = require('../../modules/calendar/icsParser');

jest.mock('../../modules/calendar/icsFetcher');
jest.mock('../../modules/calendar/icsParser');

describe.skip('Calendar Sync Lifecycle', () => {
    let user;
    let agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'calendar@example.com',
            calendar_settings: {
                enabled: true,
                icsUrl: 'https://example.com/calendar.ics',
                syncPreset: '6h',
                lastSyncedAt: null,
                lastSyncError: null,
                etag: null,
                lastModified: null,
            },
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'calendar@example.com',
            password: 'password123',
        });

        jest.clearAllMocks();
    });

    describe('POST /api/calendar/sync - Add Events', () => {
        it('should add new events from ICS feed', async () => {
            const mockEvents = [
                {
                    ical_uid: 'event1@example.com',
                    title: 'Team Meeting',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                    location: 'Conference Room A',
                    description: 'Weekly team sync',
                },
                {
                    ical_uid: 'event2@example.com',
                    title: 'Lunch Break',
                    starts_at: new Date('2026-03-01T12:00:00Z'),
                    ends_at: new Date('2026-03-01T13:00:00Z'),
                    all_day: false,
                    location: null,
                    description: null,
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
                etag: 'etag123',
                lastModified: 'Wed, 21 Feb 2026 12:00:00 GMT',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(2);
            expect(response.body.updated).toBe(0);
            expect(response.body.deleted).toBe(0);

            const events = await CalendarEvent.findAll({
                where: { user_id: user.id },
                order: [['starts_at', 'ASC']],
            });

            expect(events).toHaveLength(2);
            expect(events[0].title).toBe('Team Meeting');
            expect(events[0].ical_uid).toBe('event1@example.com');
            expect(events[0].location).toBe('Conference Room A');
            expect(events[1].title).toBe('Lunch Break');
        });

        it('should handle all-day events', async () => {
            const mockEvents = [
                {
                    ical_uid: 'allday@example.com',
                    title: 'Company Holiday',
                    starts_at: new Date('2026-03-15T00:00:00Z'),
                    ends_at: new Date('2026-03-15T23:59:59Z'),
                    all_day: true,
                    location: null,
                    description: 'Office closed',
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(1);

            const event = await CalendarEvent.findOne({
                where: { user_id: user.id },
            });

            expect(event.all_day).toBe(true);
            expect(event.title).toBe('Company Holiday');
        });

        it('should filter out events without ical_uid', async () => {
            const mockEvents = [
                {
                    ical_uid: 'valid@example.com',
                    title: 'Valid Event',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                },
                {
                    ical_uid: null,
                    title: 'Invalid Event',
                    starts_at: new Date('2026-03-01T12:00:00Z'),
                    ends_at: new Date('2026-03-01T13:00:00Z'),
                    all_day: false,
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(1);

            const events = await CalendarEvent.findAll({
                where: { user_id: user.id },
            });

            expect(events).toHaveLength(1);
            expect(events[0].title).toBe('Valid Event');
        });

        it('should filter out events without starts_at', async () => {
            const mockEvents = [
                {
                    ical_uid: 'valid@example.com',
                    title: 'Valid Event',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                },
                {
                    ical_uid: 'invalid@example.com',
                    title: 'Invalid Event',
                    starts_at: null,
                    ends_at: new Date('2026-03-01T13:00:00Z'),
                    all_day: false,
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(1);
        });
    });

    describe('POST /api/calendar/sync - Update Events', () => {
        beforeEach(async () => {
            await CalendarEvent.create({
                user_id: user.id,
                source: 'ics',
                ical_uid: 'event1@example.com',
                title: 'Old Meeting Title',
                starts_at: new Date('2026-03-01T10:00:00Z'),
                ends_at: new Date('2026-03-01T11:00:00Z'),
                all_day: false,
                location: 'Room A',
                description: 'Old description',
            });
        });

        it('should update existing event when title changes', async () => {
            const mockEvents = [
                {
                    ical_uid: 'event1@example.com',
                    title: 'New Meeting Title',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                    location: 'Room A',
                    description: 'Old description',
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(0);
            expect(response.body.updated).toBe(1);
            expect(response.body.deleted).toBe(0);

            const event = await CalendarEvent.findOne({
                where: { user_id: user.id },
            });

            expect(event.title).toBe('New Meeting Title');
        });

        it('should update event when location changes', async () => {
            const mockEvents = [
                {
                    ical_uid: 'event1@example.com',
                    title: 'Old Meeting Title',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                    location: 'Room B',
                    description: 'Old description',
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.updated).toBe(1);

            const event = await CalendarEvent.findOne({
                where: { user_id: user.id },
            });

            expect(event.location).toBe('Room B');
        });

        it('should update event when ends_at changes', async () => {
            const mockEvents = [
                {
                    ical_uid: 'event1@example.com',
                    title: 'Old Meeting Title',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T12:00:00Z'),
                    all_day: false,
                    location: 'Room A',
                    description: 'Old description',
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.updated).toBe(1);

            const event = await CalendarEvent.findOne({
                where: { user_id: user.id },
            });

            expect(event.ends_at.getTime()).toBe(
                new Date('2026-03-01T12:00:00Z').getTime()
            );
        });

        it('should not update event when nothing changes', async () => {
            const mockEvents = [
                {
                    ical_uid: 'event1@example.com',
                    title: 'Old Meeting Title',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                    location: 'Room A',
                    description: 'Old description',
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(0);
            expect(response.body.updated).toBe(0);
            expect(response.body.deleted).toBe(0);
        });

        it('should update multiple fields at once', async () => {
            const mockEvents = [
                {
                    ical_uid: 'event1@example.com',
                    title: 'Completely New Title',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T12:00:00Z'),
                    all_day: true,
                    location: 'New Location',
                    description: 'New description',
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.updated).toBe(1);

            const event = await CalendarEvent.findOne({
                where: { user_id: user.id },
            });

            expect(event.title).toBe('Completely New Title');
            expect(event.location).toBe('New Location');
            expect(event.description).toBe('New description');
            expect(event.all_day).toBe(true);
        });
    });

    describe('POST /api/calendar/sync - Delete Events', () => {
        beforeEach(async () => {
            await CalendarEvent.bulkCreate([
                {
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'event1@example.com',
                    title: 'Meeting 1',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                },
                {
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'event2@example.com',
                    title: 'Meeting 2',
                    starts_at: new Date('2026-03-01T14:00:00Z'),
                    ends_at: new Date('2026-03-01T15:00:00Z'),
                    all_day: false,
                },
                {
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'event3@example.com',
                    title: 'Meeting 3',
                    starts_at: new Date('2026-03-02T10:00:00Z'),
                    ends_at: new Date('2026-03-02T11:00:00Z'),
                    all_day: false,
                },
            ]);
        });

        it('should delete events not in ICS feed', async () => {
            const mockEvents = [
                {
                    ical_uid: 'event1@example.com',
                    title: 'Meeting 1',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(0);
            expect(response.body.updated).toBe(0);
            expect(response.body.deleted).toBe(2);

            const events = await CalendarEvent.findAll({
                where: { user_id: user.id },
            });

            expect(events).toHaveLength(1);
            expect(events[0].ical_uid).toBe('event1@example.com');
        });

        it('should delete all events when ICS feed is empty', async () => {
            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue([]);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.deleted).toBe(3);

            const events = await CalendarEvent.findAll({
                where: { user_id: user.id },
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('POST /api/calendar/sync - Combined Operations', () => {
        beforeEach(async () => {
            await CalendarEvent.bulkCreate([
                {
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'existing@example.com',
                    title: 'Old Title',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                },
                {
                    user_id: user.id,
                    source: 'ics',
                    ical_uid: 'delete@example.com',
                    title: 'To Be Deleted',
                    starts_at: new Date('2026-03-01T14:00:00Z'),
                    ends_at: new Date('2026-03-01T15:00:00Z'),
                    all_day: false,
                },
            ]);
        });

        it('should handle add, update, and delete in single sync', async () => {
            const mockEvents = [
                {
                    ical_uid: 'existing@example.com',
                    title: 'Updated Title',
                    starts_at: new Date('2026-03-01T10:00:00Z'),
                    ends_at: new Date('2026-03-01T11:00:00Z'),
                    all_day: false,
                },
                {
                    ical_uid: 'new@example.com',
                    title: 'New Event',
                    starts_at: new Date('2026-03-01T16:00:00Z'),
                    ends_at: new Date('2026-03-01T17:00:00Z'),
                    all_day: false,
                },
            ];

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue(mockEvents);

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(1);
            expect(response.body.updated).toBe(1);
            expect(response.body.deleted).toBe(1);

            const events = await CalendarEvent.findAll({
                where: { user_id: user.id },
                order: [['starts_at', 'ASC']],
            });

            expect(events).toHaveLength(2);
            expect(events[0].title).toBe('Updated Title');
            expect(events[1].title).toBe('New Event');
        });
    });

    describe('POST /api/calendar/sync - Error Handling', () => {
        it('should handle fetch error', async () => {
            icsFetcher.fetchIcs.mockResolvedValue({
                success: false,
                error: 'Network error',
            });

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('error');
        });

        it('should handle missing ICS URL', async () => {
            await User.update(
                {
                    calendar_settings: {
                        enabled: true,
                        icsUrl: '',
                        syncPreset: '6h',
                    },
                },
                { where: { id: user.id } }
            );

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(0);
            expect(response.body.updated).toBe(0);
            expect(response.body.deleted).toBe(0);
        });

        it('should return 409 when sync already in progress', async () => {
            await User.update(
                {
                    calendar_settings: {
                        enabled: true,
                        icsUrl: 'https://example.com/calendar.ics',
                        syncPreset: '6h',
                        calendar_sync_locked_at: new Date().toISOString(),
                    },
                },
                { where: { id: user.id } }
            );

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(409);
            expect(response.body.message).toContain('already in progress');
        });
    });

    describe('POST /api/calendar/sync - ETags and Caching', () => {
        it('should handle 304 Not Modified response', async () => {
            await User.update(
                {
                    calendar_settings: {
                        enabled: true,
                        icsUrl: 'https://example.com/calendar.ics',
                        syncPreset: '6h',
                        etag: 'etag123',
                        lastModified: 'Wed, 21 Feb 2026 12:00:00 GMT',
                    },
                },
                { where: { id: user.id } }
            );

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 304,
            });

            const response = await agent.post('/api/calendar/sync');

            expect(response.status).toBe(200);
            expect(response.body.added).toBe(0);
            expect(response.body.updated).toBe(0);
            expect(response.body.deleted).toBe(0);
            expect(response.body.skippedNotModified).toBe(1);
        });

        it('should pass etag and lastModified to fetcher', async () => {
            await User.update(
                {
                    calendar_settings: {
                        enabled: true,
                        icsUrl: 'https://example.com/calendar.ics',
                        syncPreset: '6h',
                        etag: 'etag123',
                        lastModified: 'Wed, 21 Feb 2026 12:00:00 GMT',
                    },
                },
                { where: { id: user.id } }
            );

            icsFetcher.fetchIcs.mockResolvedValue({
                success: true,
                statusCode: 200,
                data: 'ICS_DATA',
            });

            icsParser.parseIcs.mockReturnValue([]);

            await agent.post('/api/calendar/sync');

            expect(icsFetcher.fetchIcs).toHaveBeenCalledWith(
                'https://example.com/calendar.ics',
                expect.objectContaining({
                    etag: 'etag123',
                    lastModified: 'Wed, 21 Feb 2026 12:00:00 GMT',
                })
            );
        });
    });
});
