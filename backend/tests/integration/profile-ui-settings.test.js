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

    it('saves the projects completed setting', async () => {
        await agent.put('/api/profile/ui-settings').send({
            project: { list: { showSomeday: false, showCompleted: true } },
        });

        const profile = await agent.get('/api/profile');
        expect(profile.body.ui_settings.project.list).toEqual({
            showSomeday: false,
            showCompleted: true,
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

    it('saves the Everyone column order, deduped and trimmed', async () => {
        const res = await agent.put('/api/profile/ui-settings').send({
            everyone: { column_order: [' b ', 'a', 'b', '', 7] },
        });
        expect(res.status).toBe(200);

        const profile = await agent.get('/api/profile');
        expect(profile.body.ui_settings.everyone).toEqual({
            column_order: ['b', 'a'],
        });
    });

    it('rejects a column order that is not a list', async () => {
        const res = await agent
            .put('/api/profile/ui-settings')
            .send({ everyone: { column_order: 'a,b' } });
        expect(res.status).toBe(400);
    });

    it('keeps the Everyone column order on a full profile save', async () => {
        await agent
            .put('/api/profile/ui-settings')
            .send({ everyone: { column_order: ['a', 'b'] } });
        await agent
            .patch('/api/profile')
            .send({ ui_settings: { project: { details: {} } } });

        const profile = await agent.get('/api/profile');
        expect(profile.body.ui_settings.everyone.column_order).toEqual([
            'a',
            'b',
        ]);
    });
});
