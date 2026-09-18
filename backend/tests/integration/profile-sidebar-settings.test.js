'use strict';

const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('PUT /api/profile/sidebar-settings', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'test@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    it('should save visibleSections setting', async () => {
        const response = await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ visibleSections: { upcomingTasks: false } });

        expect(response.status).toBe(200);
        expect(
            response.body.sidebar_settings.visibleSections.upcomingTasks
        ).toBe(false);
    });

    it('should persist settings across requests', async () => {
        await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ visibleSections: { upcomingTasks: false } });

        const profile = await agent.get('/api/v1/profile');
        expect(profile.status).toBe(200);
        expect(
            profile.body.sidebar_settings.visibleSections.upcomingTasks
        ).toBe(false);
    });

    it('should preserve pinnedViewsOrder when updating visibleSections', async () => {
        await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ pinnedViewsOrder: ['abc123'] });
        await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ visibleSections: { upcomingTasks: false } });

        const profile = await agent.get('/api/v1/profile');
        expect(profile.body.sidebar_settings.pinnedViewsOrder).toEqual([
            'abc123',
        ]);
        expect(
            profile.body.sidebar_settings.visibleSections.upcomingTasks
        ).toBe(false);
    });

    it('should reject a non-object visibleSections', async () => {
        const response = await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ visibleSections: 'nope' });

        expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
        const response = await request(app)
            .put('/api/v1/profile/sidebar-settings')
            .send({ visibleSections: { upcomingTasks: false } });

        expect(response.status).toBe(401);
    });
});
