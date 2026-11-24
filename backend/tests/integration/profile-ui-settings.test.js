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

    describe('pinned boards', () => {
        const board = (overrides = {}) => ({
            id: 'b1',
            name: 'Site sprint',
            path: '/boards/kanban?project=p1,p2&tags=urgent',
            ...overrides,
        });

        it('saves pinned boards trimmed and deduped by id', async () => {
            const res = await agent.put('/api/profile/ui-settings').send({
                pinned_boards: [
                    board({ name: '  Site sprint  ' }),
                    board({ name: 'Duplicate' }),
                    board({
                        id: 'b2',
                        name: 'Urgent',
                        path: '/boards/eisenhower',
                    }),
                ],
            });
            expect(res.status).toBe(200);

            const profile = await agent.get('/api/profile');
            expect(profile.body.ui_settings.pinned_boards).toEqual([
                board(),
                { id: 'b2', name: 'Urgent', path: '/boards/eisenhower' },
            ]);
        });

        it.each([
            ['an external URL', { path: 'https://example.com/boards/kanban' }],
            ['another page', { path: '/projects' }],
            ['a protocol-relative URL', { path: '//example.com' }],
            ['a fragment', { path: '/boards/kanban#x' }],
            ['an empty name', { name: '   ' }],
            ['a name too long', { name: 'x'.repeat(121) }],
            ['a malformed id', { id: 'a b' }],
        ])('rejects %s', async (_label, overrides) => {
            const res = await agent
                .put('/api/profile/ui-settings')
                .send({ pinned_boards: [board(overrides)] });
            expect(res.status).toBe(400);
        });

        it('rejects more than fifty boards and a non-list', async () => {
            const many = Array.from({ length: 51 }, (_, i) =>
                board({ id: `b${i}` })
            );
            expect(
                (
                    await agent
                        .put('/api/profile/ui-settings')
                        .send({ pinned_boards: many })
                ).status
            ).toBe(400);
            expect(
                (
                    await agent
                        .put('/api/profile/ui-settings')
                        .send({ pinned_boards: 'b1' })
                ).status
            ).toBe(400);
        });

        it('clears them with null and leaves the focus alone', async () => {
            await agent.put('/api/profile/ui-settings').send({
                focus: { area_uid: 'a1' },
                pinned_boards: [board()],
            });
            await agent
                .put('/api/profile/ui-settings')
                .send({ pinned_boards: null });

            const profile = await agent.get('/api/profile');
            expect(profile.body.ui_settings.pinned_boards).toEqual([]);
            expect(profile.body.ui_settings.focus).toEqual({ area_uid: 'a1' });
        });

        it('keeps them on a full profile save', async () => {
            await agent
                .put('/api/profile/ui-settings')
                .send({ pinned_boards: [board()] });
            await agent
                .patch('/api/profile')
                .send({ ui_settings: { project: { details: {} } } });

            const profile = await agent.get('/api/profile');
            expect(profile.body.ui_settings.pinned_boards).toEqual([board()]);
        });
    });
});
