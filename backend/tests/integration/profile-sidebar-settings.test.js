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

    it('should save and persist widthPercent', async () => {
        const response = await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ widthPercent: 94 });

        expect(response.status).toBe(200);
        expect(response.body.sidebar_settings.widthPercent).toBe(94);

        const profile = await agent.get('/api/v1/profile');
        expect(profile.body.sidebar_settings.widthPercent).toBe(94);
    });

    it('should accept the edges of the allowed width range', async () => {
        for (const widthPercent of [90, 100, 110]) {
            const response = await agent
                .put('/api/v1/profile/sidebar-settings')
                .send({ widthPercent });

            expect(response.status).toBe(200);
            expect(response.body.sidebar_settings.widthPercent).toBe(
                widthPercent
            );
        }
    });

    it('should keep widthPercent when updating other settings', async () => {
        await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ widthPercent: 95 });
        await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ visibleSections: { upcomingTasks: false } });

        const profile = await agent.get('/api/v1/profile');
        expect(profile.body.sidebar_settings.widthPercent).toBe(95);
    });

    it.each([89.9, 110.1, 0, -5, 1000, '95', null, NaN, {}])(
        'should reject widthPercent %p',
        async (widthPercent) => {
            const response = await agent
                .put('/api/v1/profile/sidebar-settings')
                .send({ widthPercent });

            expect(response.status).toBe(400);
        }
    );

    it('should save and persist linkOrder and sectionOrder', async () => {
        const linkOrder = ['today', 'inbox', 'allTasks'];
        const sectionOrder = ['notes', 'projects', 'areas'];

        const response = await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ linkOrder, sectionOrder });

        expect(response.status).toBe(200);
        expect(response.body.sidebar_settings.linkOrder).toEqual(linkOrder);
        expect(response.body.sidebar_settings.sectionOrder).toEqual(
            sectionOrder
        );

        const profile = await agent.get('/api/v1/profile');
        expect(profile.body.sidebar_settings.linkOrder).toEqual(linkOrder);
        expect(profile.body.sidebar_settings.sectionOrder).toEqual(
            sectionOrder
        );
    });

    it('should keep the orders when updating other settings', async () => {
        await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ sectionOrder: ['notes', 'projects'] });
        await agent
            .put('/api/v1/profile/sidebar-settings')
            .send({ visibleSections: { upcomingTasks: false } });

        const profile = await agent.get('/api/v1/profile');
        expect(profile.body.sidebar_settings.sectionOrder).toEqual([
            'notes',
            'projects',
        ]);
    });

    it.each([
        ['a string', 'inbox'],
        ['an object', {}],
        ['a non-string entry', ['inbox', 3]],
        ['an empty id', ['']],
        ['an id that is too long', ['x'.repeat(65)]],
        ['too many entries', Array.from({ length: 51 }, (_, i) => `id${i}`)],
    ])(
        'should reject a linkOrder or sectionOrder that is %s',
        async (_n, v) => {
            for (const field of ['linkOrder', 'sectionOrder']) {
                const response = await agent
                    .put('/api/v1/profile/sidebar-settings')
                    .send({ [field]: v });

                expect(response.status).toBe(400);
            }
        }
    );

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
