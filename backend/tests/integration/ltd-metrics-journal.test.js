'use strict';
const request = require('supertest');
const app = require('../../app');
const {
    Goal,
    LtdGoalMetric,
    LtdMetricCheckin,
    LtdJournal,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const metrics = require('../../modules/ltd-metrics/service');
const journal = require('../../modules/ltd-journal/service');
const goals = require('../../modules/goals/service');

const actor = (user) => ({ user_id: user.id, actor_type: 'user' });
const metricData = { name: 'Distance', baseline: 0, target: 10 };

describe('Phase 4 metrics and journal', () => {
    let userA, userB, goal, agent;
    beforeEach(async () => {
        userA = await createTestUser({ email: 'metrics-a@example.com' });
        userB = await createTestUser({ email: 'metrics-b@example.com' });
        goal = await Goal.create({
            user_id: userA.id,
            title: 'Run comfortably',
            horizon: 'year',
        });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: userA.email, password: 'password123' })
            .expect(200);
    });

    it('CRUD and check-in use current_value and create an atomic journal entry', async () => {
        const created = await agent
            .post(`/api/goals/${goal.uid}/metrics`)
            .send(metricData)
            .expect(201);
        expect(created.body.metric.current_value).toBe(0);
        const uid = created.body.metric.uid;
        await agent
            .patch(`/api/metrics/${uid}`)
            .send({ name: 'Weekly distance', unit: 'km', weight: 2 })
            .expect(200);
        const checked = await agent
            .post(`/api/metrics/${uid}/checkins`)
            .send({ value: 5, note: 'Steady pace' })
            .expect(201);
        expect(checked.body.metric.current_value).toBe(5);
        expect(checked.body.checkin.source).toBe('user');
        const read = await agent
            .get(`/api/goals/${goal.uid}/metrics`)
            .expect(200);
        expect(read.body.metrics[0].checkins).toHaveLength(1);
        await agent
            .post(`/api/journal/${checked.body.journal_uid}/revert`)
            .send({})
            .expect(200);
        expect(
            (await LtdGoalMetric.findOne({ where: { uid } })).current_value
        ).toBe(0);
        expect(await LtdMetricCheckin.count()).toBe(0);
        expect(
            (
                await LtdJournal.findOne({
                    where: { uid: checked.body.journal_uid },
                })
            ).reverted_at
        ).not.toBeNull();
        const activity = await agent.get('/api/journal').expect(200);
        expect(activity.body.entries).toHaveLength(3);
        await agent.delete(`/api/metrics/${uid}`).expect(204);
        expect(await LtdGoalMetric.count()).toBe(0);
        const deleted = (await journal.list(userA.id))[0];
        await journal.revert(userA.id, [deleted.uid]);
        expect(await LtdGoalMetric.count()).toBe(1);
    });

    it('isolates another owner in list, create, read/write/check-in and undo', async () => {
        const metric = await metrics.create(userA.id, goal.uid, metricData);
        const checked = await metrics.checkin(userA.id, metric.uid, {
            value: 5,
        });
        const other = request.agent(app);
        await other
            .post('/api/login')
            .send({ email: userB.email, password: 'password123' })
            .expect(200);
        await other.get(`/api/goals/${goal.uid}/metrics`).expect(404);
        await other
            .post(`/api/goals/${goal.uid}/metrics`)
            .send(metricData)
            .expect(404);
        await other
            .patch(`/api/metrics/${metric.uid}`)
            .send({ target: 20 })
            .expect(404);
        await other
            .post(`/api/metrics/${metric.uid}/checkins`)
            .send({ value: 6 })
            .expect(404);
        await other.delete(`/api/metrics/${metric.uid}`).expect(404);
        await other
            .post(`/api/journal/${checked.journal_uid}/revert`)
            .send({})
            .expect(404);
        await other
            .post('/api/journal/revert')
            .send({ uids: [checked.journal_uid] })
            .expect(404);
        const list = await other.get('/api/journal').expect(200);
        expect(list.body.entries).toEqual([]);
        expect((await metric.reload()).current_value).toBe(5);
        await request(app).get('/api/journal').expect(401);
        await request(app).get(`/api/goals/${goal.uid}/metrics`).expect(401);
    });

    it('undoes check-ins as a reverse ordered group and never keeps a partial failed undo', async () => {
        const metric = await metrics.create(userA.id, goal.uid, metricData);
        const first = await metrics.checkin(userA.id, metric.uid, { value: 3 });
        const second = await metrics.checkin(userA.id, metric.uid, {
            value: 5,
        });
        await expect(
            journal.revert(userA.id, [first.journal_uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        const unrelated = await LtdJournal.create({
            user_id: userA.id,
            op: 'unsupported',
            entity_type: 'task',
            entity_uid: 'nonexistent',
        });
        // Check-in is reverted first, then the unsupported older entry aborts the group.
        await metrics.checkin(userA.id, metric.uid, { value: 7 });
        const latest = (await journal.list(userA.id))[0];
        await expect(
            journal.revert(userA.id, [unrelated.uid, latest.uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        expect((await metric.reload()).current_value).toBe(7);
        expect((await LtdJournal.findByPk(latest.id)).reverted_at).toBeNull();
        expect(await LtdMetricCheckin.count()).toBe(3);
        const response = await agent
            .post('/api/journal/revert')
            .send({ uids: [first.journal_uid, second.journal_uid, latest.uid] })
            .expect(200);
        expect(response.body.entries).toHaveLength(3);
        expect((await metric.reload()).current_value).toBe(0);
        expect(await LtdMetricCheckin.count()).toBe(0);
        await expect(
            journal.revert(userA.id, [second.journal_uid])
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('rolls back both domain changes and journal records when the callback fails', async () => {
        await expect(
            journal.withJournal(actor(userA), async (transaction, record) => {
                await goal.update({ title: 'Changed' }, { transaction });
                await record({
                    op: 'goal_update',
                    entity_type: 'goal',
                    entity_uid: goal.uid,
                    before: { title: goal.title },
                    after: { title: 'Changed' },
                });
                throw new Error('Injected failure');
            })
        ).rejects.toThrow('Injected failure');
        expect((await goal.reload()).title).toBe('Run comfortably');
        expect(await LtdJournal.count()).toBe(0);
    });

    it('reparent undo restores the previous parent and validates ownership/horizons', async () => {
        const parent = await Goal.create({
            user_id: userA.id,
            title: 'Vision',
            horizon: 'vision',
        });
        const original = await Goal.create({
            user_id: userA.id,
            title: 'Five years',
            horizon: 'five_year',
            parent_goal_id: parent.id,
        });
        await goal.update({ parent_goal_id: original.id });
        await goals.update(userA.id, goal.uid, { parent_goal_id: parent.id });
        const entry = (await journal.list(userA.id))[0];
        expect(entry.op).toBe('reparent');
        await journal.revert(userA.id, [entry.uid]);
        expect((await goal.reload()).parent_goal_id).toBe(original.id);
        await goals.update(userA.id, goal.uid, { parent_goal_id: parent.id });
        const invalid = (await journal.list(userA.id))[0];
        await original.update({ horizon: 'week' });
        await expect(
            journal.revert(userA.id, [invalid.uid])
        ).rejects.toMatchObject({ statusCode: 400 });
        expect((await goal.reload()).parent_goal_id).toBe(parent.id);
        expect((await invalid.reload()).reverted_at).toBeNull();
    });

    it('restores goal updates, handles deleted entities and safely undoes goal creation', async () => {
        await goals.update(userA.id, goal.uid, { title: 'New title' });
        await journal.revert(userA.id, [(await journal.list(userA.id))[0].uid]);
        expect((await goal.reload()).title).toBe('Run comfortably');
        const created = await goals.create(userA.id, {
            title: 'Fresh',
            horizon: 'vision',
        });
        const createdEntry = (await journal.list(userA.id))[0];
        const child = await Goal.create({
            user_id: userA.id,
            title: 'Child',
            horizon: 'year',
            parent_goal_id: created.id,
        });
        await expect(
            journal.revert(userA.id, [createdEntry.uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        await child.destroy();
        await journal.revert(userA.id, [createdEntry.uid]);
        expect(await Goal.findByPk(created.id)).toBeNull();
        await goal.destroy();
        const missing = await LtdJournal.create({
            user_id: userA.id,
            op: 'goal_update',
            entity_type: 'goal',
            entity_uid: goal.uid,
            before: { title: 'x' },
            after: { title: 'y' },
        });
        await expect(
            journal.revert(userA.id, [missing.uid])
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('undoes metric edits/deletion/creation, retaining deleted checkins', async () => {
        const metric = await metrics.create(userA.id, goal.uid, metricData);
        const createEntry = (await journal.list(userA.id))[0];
        const checked = await metrics.checkin(userA.id, metric.uid, {
            value: 4,
        });
        await expect(
            journal.revert(userA.id, [createEntry.uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        await metrics.update(userA.id, metric.uid, { name: 'Changed' });
        await journal.revert(userA.id, [(await journal.list(userA.id))[0].uid]);
        expect((await metric.reload()).name).toBe('Distance');
        await metrics.remove(userA.id, metric.uid);
        const removed = (await journal.list(userA.id))[0];
        expect(await LtdMetricCheckin.count()).toBe(0);
        await journal.revert(userA.id, [removed.uid]);
        expect(await LtdMetricCheckin.count()).toBe(1);
        await journal.revert(userA.id, [checked.journal_uid]);
        await journal.revert(userA.id, [createEntry.uid]);
        expect(await LtdGoalMetric.count()).toBe(0);
    });

    it('never rewinds an older equal-value check-in and rejects missing/unsupported operations', async () => {
        const metric = await metrics.create(userA.id, goal.uid, metricData);
        const createEntry = (await journal.list(userA.id))[0];
        const first = await metrics.checkin(userA.id, metric.uid, { value: 0 });
        const second = await metrics.checkin(userA.id, metric.uid, {
            value: 0,
        });
        await expect(
            journal.revert(userA.id, [first.journal_uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
            journal.revert(userA.id, [createEntry.uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        await LtdMetricCheckin.destroy({ where: { uid: second.checkin.uid } });
        await expect(
            journal.revert(userA.id, [second.journal_uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        const unsupported = await LtdJournal.create({
            user_id: userA.id,
            op: 'unsupported',
            entity_type: 'metric',
            entity_uid: metric.uid,
            before: {},
            after: null,
        });
        await expect(
            journal.revert(userA.id, [unsupported.uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        const invalidGoal = await LtdJournal.create({
            user_id: userA.id,
            op: 'unsupported',
            entity_type: 'goal',
            entity_uid: goal.uid,
            before: null,
            after: null,
        });
        await expect(
            journal.revert(userA.id, [invalidGoal.uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        // SQLite can return JSON text; PostgreSQL normally returns decoded objects.
        const encoded = await LtdJournal.create({
            user_id: userA.id,
            op: 'goal_update',
            entity_type: 'goal',
            entity_uid: goal.uid,
            before: JSON.stringify({ title: 'Previous' }),
            after: JSON.stringify({ title: goal.title }),
        });
        await journal.revert(userA.id, [encoded.uid]);
        expect((await goal.reload()).title).toBe('Previous');
        await metrics.remove(userA.id, metric.uid);
        const deletion = (await journal.list(userA.id))[0];
        await LtdGoalMetric.create({
            uid: metric.uid,
            goal_id: goal.id,
            ...metricData,
            current_value: 0,
        });
        await expect(
            journal.revert(userA.id, [deletion.uid])
        ).rejects.toMatchObject({ statusCode: 409 });
        await LtdGoalMetric.destroy({ where: { uid: metric.uid } });
        await goal.destroy();
        await expect(
            journal.revert(userA.id, [deletion.uid])
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('labels bearer integrations as MCP and disallows hard delete and undo', async () => {
        const {
            createApiToken,
        } = require('../../modules/users/apiTokenService');
        const { rawToken } = await createApiToken({ userId: userA.id });
        const bearer = { Authorization: `Bearer ${rawToken}` };
        const created = await request(app)
            .post(`/api/goals/${goal.uid}/metrics`)
            .set(bearer)
            .send(metricData)
            .expect(201);
        const entry = (await journal.list(userA.id))[0];
        expect(entry.actor_type).toBe('mcp');
        const uid = created.body.metric.uid;
        const checkin = await request(app)
            .post(`/api/metrics/${uid}/checkins`)
            .set(bearer)
            .send({ value: 5, source: 'user' })
            .expect(201);
        expect(checkin.body.checkin.source).toBe('mcp');
        await request(app)
            .patch(`/api/metrics/${uid}`)
            .set(bearer)
            .send({ weight: 2 })
            .expect(200);
        await request(app)
            .delete(`/api/metrics/${uid}`)
            .set(bearer)
            .expect(403);
        await request(app)
            .post(`/api/journal/${entry.uid}/revert`)
            .set(bearer)
            .send({})
            .expect(403);
        const { actorFromRequest } = require('../../modules/ltd-journal/actor');
        expect(
            actorFromRequest({ headers: {}, authToken: { id: 3 } }, userA.id)
                .actor_id
        ).toBe('3');
        await journal.withJournal(
            { user_id: userA.id },
            async (_transaction, record) =>
                record({
                    op: 'unsupported',
                    entity_type: 'goal',
                    entity_uid: goal.uid,
                })
        );
        await expect(
            journal.withJournal(actor(userA), async (_transaction, record) =>
                record(null)
            )
        ).rejects.toMatchObject({ statusCode: 400 });
        await expect(
            journal.withJournal(actor(userA), async (_transaction, record) =>
                record({ op: 'x' })
            )
        ).rejects.toMatchObject({ statusCode: 400 });
        await expect(
            journal.withJournal(actor(userA), async (_transaction, record) =>
                record({ op: 'x', entity_type: 'goal' })
            )
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('refuses malformed input, missing records and nonhuman hard deletion', async () => {
        for (const data of [
            null,
            [],
            {},
            { ...metricData, name: '' },
            { ...metricData, baseline: '0' },
            { ...metricData, target: Infinity },
            { ...metricData, weight: 0 },
            { ...metricData, direction: 'up' },
            { ...metricData, source: 'ai' },
            { ...metricData, unit: 3 },
            { ...metricData, current_value: 2 },
        ]) {
            await expect(
                metrics.create(userA.id, goal.uid, data)
            ).rejects.toMatchObject({ statusCode: 400 });
        }
        const metric = await metrics.create(userA.id, goal.uid, metricData);
        for (const data of [
            null,
            { value: '5' },
            { value: NaN },
            { value: 5, note: 1 },
            { value: 5, recorded_at: 'invalid' },
        ])
            await expect(
                metrics.checkin(userA.id, metric.uid, data)
            ).rejects.toMatchObject({ statusCode: 400 });
        for (const uids of [
            null,
            [],
            ['a', 'a'],
            [1],
            [''],
            Array(201).fill('a'),
        ])
            await expect(journal.revert(userA.id, uids)).rejects.toMatchObject({
                statusCode: 400,
            });
        await expect(
            metrics.update(userA.id, 'missing', { name: 'Fine' })
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            metrics.remove(userA.id, metric.uid, { actor_type: 'mcp' })
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
            journal.withJournal(null, async () => {})
        ).rejects.toMatchObject({ statusCode: 400 });
        await expect(
            journal.withJournal(
                { user_id: userA.id, actor_type: 'invalid' },
                async () => {}
            )
        ).rejects.toMatchObject({ statusCode: 400 });
        await expect(
            journal.withJournal(actor(userA), async (_transaction, record) =>
                record({})
            )
        ).rejects.toMatchObject({ statusCode: 400 });
        await expect(
            journal.withJournal(
                { user_id: userA.id, actor_type: 'ai' },
                async (_transaction, record) =>
                    record({
                        op: 'metric_delete',
                        entity_type: 'metric',
                        entity_uid: metric.uid,
                    })
            )
        ).rejects.toMatchObject({ statusCode: 403 });
        const aiCheckin = await metrics.checkin(
            userA.id,
            metric.uid,
            { value: 2, recorded_at: '2026-10-11T10:00:00Z' },
            { actor_type: 'ai', actor_id: 'assistant' }
        );
        expect(aiCheckin.checkin.source).toBe('ai');
    });
});
