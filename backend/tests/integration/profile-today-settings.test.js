'use strict';

const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('PUT /api/profile/today-settings', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'test@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    it('should save showSuggestions setting', async () => {
        const response = await agent
            .put('/api/v1/profile/today-settings')
            .send({ showSuggestions: true });

        expect(response.status).toBe(200);
        expect(response.body.today_settings.showSuggestions).toBe(true);
    });

    it('should persist settings across requests', async () => {
        await agent
            .put('/api/v1/profile/today-settings')
            .send({ showSuggestions: true });

        const profile = await agent.get('/api/v1/profile');
        expect(profile.status).toBe(200);
        expect(profile.body.today_settings.showSuggestions).toBe(true);
    });

    it('should preserve existing settings when updating a single field', async () => {
        await agent
            .put('/api/v1/profile/today-settings')
            .send({ showMetrics: true });
        await agent
            .put('/api/v1/profile/today-settings')
            .send({ showSuggestions: true });

        const profile = await agent.get('/api/v1/profile');
        expect(profile.body.today_settings.showMetrics).toBe(true);
        expect(profile.body.today_settings.showSuggestions).toBe(true);
    });

    it('should require authentication', async () => {
        const response = await request(app)
            .put('/api/v1/profile/today-settings')
            .send({ showSuggestions: true });

        expect(response.status).toBe(401);
    });
});
