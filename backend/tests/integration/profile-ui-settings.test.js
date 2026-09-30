'use strict';

const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('PUT /api/profile/ui-settings', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'test@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    it('saves the projects someday setting', async () => {
        await agent
            .put('/api/profile/ui-settings')
            .send({ project: { list: { showSomeday: true } } });

        const profile = await agent.get('/api/profile');
        expect(profile.body.ui_settings.project.list).toEqual({
            showSomeday: true,
        });
    });

    it('keeps the list filters when project details change', async () => {
        await agent
            .put('/api/profile/ui-settings')
            .send({ project: { list: { showSomeday: true } } });
        await agent
            .put('/api/profile/ui-settings')
            .send({ project: { details: { showMetrics: false } } });

        const profile = await agent.get('/api/profile');
        expect(profile.body.ui_settings.project.list.showSomeday).toBe(true);
        expect(profile.body.ui_settings.project.details.showMetrics).toBe(
            false
        );
    });
});
