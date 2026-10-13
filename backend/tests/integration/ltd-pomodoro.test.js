'use strict';
const request = require('supertest');
const app = require('../../app');
const { Task, LtdFocusSession, LtdJournal } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const focus = require('../../modules/ltd-focus/service');

describe('Phase 12 task-bound pomodoro', () => {
    let user, other, agent, task;
    beforeEach(async () => {
        user = await createTestUser({
            email: 'pomodoro-a@example.com',
            timezone: 'UTC',
        });
        other = await createTestUser({ email: 'pomodoro-b@example.com' });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' })
            .expect(200);
        task = await Task.create({
            user_id: user.id,
            name: 'Draft',
            estimated_minutes: 50,
        });
    });
    const read = async () =>
        (
            await agent
                .get(`/api/focus-sessions/summary?task_uids=${task.uid}`)
                .expect(200)
        ).body[task.uid];
    const patch = (body) => agent.patch(`/api/task/${task.uid}`).send(body);
    const manual = (from, to, uid = task.uid) =>
        agent.post('/api/focus-sessions/manual').send({
            task_uid: uid,
            started_at: from.toISOString(),
            ended_at: to.toISOString(),
        });
    it('defaults to 25; two intervals write 50; length edits preserve estimate and history', async () => {
        expect(await read()).toMatchObject({
            target_count: 2,
            length_minutes: 25,
            spent_minutes: 0,
        });
        await patch({ focus_minutes: 26 }).expect(400);
        await patch({ estimated_minutes: 2 * 25 }).expect(200);
        const from = new Date(Date.now() - 30 * 60000);
        const s = await focus.start(
            user.id,
            { task_uid: task.uid, planned_minutes: 60 },
            from
        );
        expect(s.planned_minutes).toBe(25);
        await focus.end(
            user.id,
            s.uid,
            {},
            new Date(from.getTime() + 25 * 60000)
        );
        await patch({ focus_minutes: 50 }).expect(200);
        expect((await task.reload()).estimated_minutes).toBe(50);
        expect(await read()).toMatchObject({
            target_count: 1,
            length_minutes: 50,
            spent_minutes: 25,
            completed_count: 1,
        });
        expect(
            (await LtdFocusSession.findOne({ where: { uid: s.uid } }))
                .planned_minutes
        ).toBe(25);
        await patch({ estimated_minutes: null }).expect(200);
        expect((await read()).target_count).toBeNull();
    });
    it('DoD: one complete interval plus a twelve-minute interruption yields 1 / 2 and 37; break and open time add nothing', async () => {
        const from = new Date(Date.now() - 100 * 60000);
        const s = await focus.start(user.id, { task_uid: task.uid }, from);
        await focus.end(
            user.id,
            s.uid,
            { ended_at: new Date(from.getTime() + 25 * 60000).toISOString() },
            new Date(from.getTime() + 35 * 60000)
        );
        const second = await focus.start(
            user.id,
            { task_uid: task.uid },
            new Date(from.getTime() + 40 * 60000)
        );
        await focus.end(
            user.id,
            second.uid,
            { interrupted: true, resume_note: 'Section 2' },
            new Date(from.getTime() + 52 * 60000)
        );
        await focus.start(user.id, { task_uid: task.uid });
        expect(await read()).toEqual({
            target_count: 2,
            length_minutes: 25,
            spent_minutes: 37,
            completed_count: 1,
        });
        expect(
            (await agent.get('/api/focus-sessions/today').expect(200)).body
        ).toEqual({ spent_minutes: 37, completed_count: 1 });
        expect(await LtdJournal.count()).toBe(0);
        await agent
            .post('/api/focus-sessions')
            .send({ task_uid: task.uid })
            .expect(409);
    });
    it('summaries include lifetime minutes, while today uses the user timezone', async () => {
        const from = new Date(Date.now() - 2 * 86400000);
        await manual(from, new Date(from.getTime() + 25 * 60000)).expect(201);
        expect((await read()).spent_minutes).toBe(25);
        expect(
            (await agent.get('/api/focus-sessions/today').expect(200)).body
                .spent_minutes
        ).toBe(0);
    });
    it('cannot see or end another user’s sessions or summarize their task', async () => {
        const foreign = await Task.create({
            user_id: other.id,
            name: 'Private',
        });
        const s = await focus.start(other.id, { task_uid: foreign.uid });
        expect(
            (
                await agent
                    .get(`/api/focus-sessions/summary?task_uids=${foreign.uid}`)
                    .expect(200)
            ).body
        ).toEqual({});
        await agent
            .post(`/api/focus-sessions/${s.uid}/end`)
            .send({})
            .expect(404);
        await manual(
            new Date(Date.now() - 30 * 60000),
            new Date(Date.now() - 5 * 60000),
            foreign.uid
        ).expect(404);
        await agent
            .get(
                '/api/focus-sessions/summary?task_uids=' +
                    Array(101).fill(task.uid).join(',')
            )
            .expect(400);
    });
    it('rejects manual overlap for the user, future, old and invalid duration; allows adjacent intervals', async () => {
        const from = new Date(Date.now() - 60 * 60000);
        const to = new Date(from.getTime() + 25 * 60000);
        await manual(from, to).expect(201);
        const another = await Task.create({
            user_id: user.id,
            name: 'Other task',
        });
        await manual(
            new Date(from.getTime() + 10 * 60000),
            new Date(to.getTime() + 10 * 60000),
            another.uid
        ).expect(409);
        await manual(to, new Date(to.getTime() + 5 * 60000)).expect(201);
        await manual(new Date(), new Date(Date.now() + 60000)).expect(400);
        const old = new Date(Date.now() - 8 * 86400000);
        await manual(old, new Date(old.getTime() + 60000)).expect(400);
        await manual(
            new Date(Date.now() - 300 * 60000),
            new Date(Date.now() - 10 * 60000)
        ).expect(400);
        await manual(from, new Date(from.getTime() + 30000)).expect(400);
    });
    it('ends at the bell without counting waiting and rejects future end times', async () => {
        const from = new Date(Date.now() - 45 * 60000);
        const s = await focus.start(user.id, { task_uid: task.uid }, from);
        await agent
            .post(`/api/focus-sessions/${s.uid}/end`)
            .send({ ended_at: new Date(Date.now() + 60000).toISOString() })
            .expect(400);
        const ended = await agent
            .post(`/api/focus-sessions/${s.uid}/end`)
            .send({
                ended_at: new Date(from.getTime() + 25 * 60000).toISOString(),
            })
            .expect(200);
        expect(ended.body.session.actual_minutes).toBe(25);
    });
    it('closes abandoned sessions at the bell after planned + 120, also when ending directly', async () => {
        const from = new Date(Date.now() - 146 * 60000);
        const s = await focus.start(user.id, { task_uid: task.uid }, from);
        const closed = await agent
            .get('/api/focus-sessions/current')
            .expect(200);
        expect(closed.body.session).toMatchObject({
            uid: s.uid,
            actual_minutes: 25,
            auto_closed: true,
        });
        const second = await focus.start(user.id, { task_uid: task.uid }, from);
        const ended = await agent
            .post(`/api/focus-sessions/${second.uid}/end`)
            .send({})
            .expect(200);
        expect(ended.body.session).toMatchObject({
            actual_minutes: 25,
            auto_closed: true,
        });
    });
    it('accepts all twelve 90-minute estimates and leaves task default nullable', async () => {
        await patch({ focus_minutes: 90, estimated_minutes: 1080 }).expect(200);
        expect(await read()).toMatchObject({
            length_minutes: 90,
            target_count: 12,
        });
        await patch({ focus_minutes: null }).expect(200);
        expect((await task.reload()).focus_minutes).toBeNull();
    });
    it('API tokens cannot create, resume, end or manually record sessions', async () => {
        const {
            createApiToken,
        } = require('../../modules/users/apiTokenService');
        const { rawToken } = await createApiToken({ userId: user.id });
        const s = await focus.start(user.id, { task_uid: task.uid });
        for (const route of [
            'focus-sessions',
            'focus-sessions/manual',
            `focus-sessions/${s.uid}/end`,
            `focus-sessions/${s.uid}/resume`,
        ]) {
            await request(app)
                .post(`/api/${route}`)
                .set('Authorization', `Bearer ${rawToken}`)
                .send({ task_uid: task.uid })
                .expect(403);
        }
        expect(
            await LtdFocusSession.count({ where: { user_id: user.id } })
        ).toBe(1);
    });
    it('simultaneous starts cannot open two timers for the same user', async () => {
        const results = await Promise.allSettled([
            focus.start(user.id, { task_uid: task.uid }),
            focus.start(user.id, { task_uid: task.uid }),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(
            await LtdFocusSession.count({
                where: { user_id: user.id, ended_at: null },
            })
        ).toBe(1);
    });
    it('saves preferences in ui_settings and task NULL inherits them', async () => {
        await agent
            .put('/api/focus-sessions/settings')
            .send({ focus_minutes: 30, sound: false })
            .expect(200);
        expect((await read()).length_minutes).toBe(30);
        await agent
            .put('/api/focus-sessions/settings')
            .send({ focus_minutes: 31 })
            .expect(400);
    });
});
