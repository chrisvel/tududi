const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Calendar Settings Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `test_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('PUT /api/profile/calendar-settings', () => {
        it('should persist calendar settings and return masked URL', async () => {
            const calendarData = {
                icsUrl: 'https://example.com/calendar/secret-token-12345',
                syncPreset: '6h',
            };

            const response = await agent
                .put('/api/profile/calendar-settings')
                .send(calendarData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('calendar_settings');
            expect(response.body.calendar_settings).toHaveProperty('icsUrl');
            expect(response.body.calendar_settings).toHaveProperty(
                'syncPreset'
            );
            expect(response.body.calendar_settings).toHaveProperty('enabled');

            expect(response.body.calendar_settings.icsUrl).not.toBe(
                calendarData.icsUrl
            );
            expect(response.body.calendar_settings.icsUrl).toContain('***');
            expect(response.body.calendar_settings.syncPreset).toBe(
                calendarData.syncPreset
            );
        });

        it('should auto-enable calendar when URL is set', async () => {
            const calendarData = {
                icsUrl: 'https://example.com/calendar/secret-token-12345',
                syncPreset: '6h',
                enabled: true,
            };

            const response = await agent
                .put('/api/profile/calendar-settings')
                .send(calendarData);

            expect(response.status).toBe(200);
            expect(response.body.calendar_settings.enabled).toBe(true);
        });

        it('should auto-disable calendar when URL is cleared', async () => {
            await agent.put('/api/profile/calendar-settings').send({
                icsUrl: 'https://example.com/calendar/secret-token-12345',
                syncPreset: '6h',
                enabled: true,
            });

            const response = await agent
                .put('/api/profile/calendar-settings')
                .send({
                    icsUrl: '',
                    enabled: false,
                });

            expect(response.status).toBe(200);
            expect(response.body.calendar_settings.enabled).toBe(false);
            expect(response.body.calendar_settings.icsUrl).toBe('');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .put('/api/profile/calendar-settings')
                .send({
                    icsUrl: 'https://example.com/calendar/secret-token-12345',
                    syncPreset: '6h',
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('POST /api/profile/calendar-settings/reveal', () => {
        it('should reveal full calendar URL', async () => {
            const fullUrl = 'https://example.com/calendar/secret-token-12345';

            const putResponse = await agent
                .put('/api/profile/calendar-settings')
                .send({
                    icsUrl: fullUrl,
                    syncPreset: '6h',
                    enabled: true,
                });

            expect(putResponse.body.calendar_settings.icsUrl).not.toBe(fullUrl);
            expect(putResponse.body.calendar_settings.icsUrl).toContain('***');

            const revealResponse = await agent.post(
                '/api/profile/calendar-settings/reveal'
            );

            expect(revealResponse.status).toBe(200);
            expect(revealResponse.body.success).toBe(true);
            expect(revealResponse.body).toHaveProperty('calendar_settings');
            expect(revealResponse.body.calendar_settings).toHaveProperty(
                'icsUrl'
            );
            expect(revealResponse.body.calendar_settings).toHaveProperty(
                'syncPreset'
            );
            expect(revealResponse.body.calendar_settings).toHaveProperty(
                'enabled'
            );

            expect(revealResponse.body.calendar_settings.icsUrl).toBe(fullUrl);
            expect(revealResponse.body.calendar_settings.syncPreset).toBe('6h');
            expect(revealResponse.body.calendar_settings.enabled).toBe(true);
        });

        it('should return empty string when no calendar URL is set', async () => {
            const response = await agent.post(
                '/api/profile/calendar-settings/reveal'
            );

            expect(response.status).toBe(200);
            expect(response.body.calendar_settings.icsUrl).toBe('');
            expect(response.body.calendar_settings.enabled).toBe(false);
        });

        it('should require authentication', async () => {
            const response = await request(app).post(
                '/api/profile/calendar-settings/reveal'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('Calendar Settings Persistence', () => {
        it('should persist settings across multiple requests', async () => {
            const fullUrl = 'https://example.com/calendar/secret-token-12345';

            const putResponse = await agent
                .put('/api/profile/calendar-settings')
                .send({
                    icsUrl: fullUrl,
                    syncPreset: '6h',
                    enabled: true,
                });

            expect(putResponse.status).toBe(200);
            expect(putResponse.body.calendar_settings.icsUrl).toContain('***');
            expect(putResponse.body.calendar_settings.enabled).toBe(true);

            const revealResponse = await agent.post(
                '/api/profile/calendar-settings/reveal'
            );
            expect(revealResponse.status).toBe(200);
            expect(revealResponse.body.calendar_settings.icsUrl).toBe(fullUrl);
        });

        it('should allow updating preset without changing URL', async () => {
            const fullUrl = 'https://example.com/calendar/secret-token-12345';

            await agent.put('/api/profile/calendar-settings').send({
                icsUrl: fullUrl,
                syncPreset: '6h',
                enabled: true,
            });

            const response = await agent
                .put('/api/profile/calendar-settings')
                .send({
                    icsUrl: fullUrl,
                    syncPreset: '1h',
                });

            expect(response.status).toBe(200);
            expect(response.body.calendar_settings.syncPreset).toBe('1h');
            expect(response.body.calendar_settings.enabled).toBe(true);

            const revealResponse = await agent.post(
                '/api/profile/calendar-settings/reveal'
            );
            expect(revealResponse.body.calendar_settings.icsUrl).toBe(fullUrl);
            expect(revealResponse.body.calendar_settings.syncPreset).toBe('1h');
        });
    });
});
