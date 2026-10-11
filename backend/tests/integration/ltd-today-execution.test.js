'use strict';
const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { Task, Goal, LtdFocusSession, LtdJournal } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const focus = require('../../modules/ltd-focus/service');
const planner = require('../../modules/ltd-planner/service');
const push = require('../../modules/push/service');
const pushRepository = require('../../modules/push/repository');

const TZ = 'Europe/Athens';
const actor = (user) => ({ user_id: user.id, actor_type: 'user' });

describe('Phase 5 today execution', () => {
    let user, other, agent, today, tomorrow;
    beforeEach(async () => {
        user = await createTestUser({
            email: 'today-a@example.com',
            timezone: TZ,
        });
        other = await createTestUser({ email: 'today-b@example.com' });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' })
            .expect(200);
        today = moment.tz(TZ).format('YYYY-MM-DD');
        tomorrow = moment.tz(TZ).add(1, 'day').format('YYYY-MM-DD');
    });

    const makeTask = (attrs = {}) =>
        Task.create({ name: 'A task', user_id: user.id, ...attrs });
    const plan = (date, items) =>
        agent.put(`/api/daily-plan/${date}`).send({ items }).expect(200);
    const planUids = async (date) =>
        (
            await agent.get(`/api/daily-plan?date=${date}`).expect(200)
        ).body.plan?.items.map((i) => i.task_uid) ?? [];

    describe('T-503 starter_step', () => {
        it('is nullable, saved on create and update, cleared when empty', async () => {
            const created = await agent
                .post('/api/task')
                .send({ name: 'Write report', starter_step: ' Open the doc ' })
                .expect(201);
            expect(created.body.starter_step).toBe('Open the doc');
            const plain = await agent
                .post('/api/task')
                .send({ name: 'No step' })
                .expect(201);
            expect(plain.body.starter_step ?? null).toBeNull();
            const cleared = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ starter_step: '' })
                .expect(200);
            expect(cleared.body.starter_step).toBeNull();
            await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ starter_step: 'x'.repeat(501) })
                .expect(400);
        });
    });

    describe('T-501 capacity', () => {
        it('defaults to 09:00-17:00 and saves other work hours', async () => {
            const read = await agent.get('/api/planner/work-hours').expect(200);
            expect(read.body).toEqual({ start: 540, end: 1020 });
            await agent
                .put('/api/planner/work-hours')
                .send({ start: 600, end: 540 })
                .expect(400);
            await agent
                .put('/api/planner/work-hours')
                .send({ start: 480, end: 960 })
                .expect(200);
            const cap = await agent.get('/api/planner/capacity').expect(200);
            expect(cap.body.window).toEqual({ start: 480, end: 960 });
        });

        it('warns when the plan exceeds 85% and suggests the lowest priority', async () => {
            const high = await makeTask({ name: 'High', priority: 2 });
            const low = await makeTask({ name: 'Low', priority: 0 });
            await agent
                .put('/api/planner/work-hours')
                .send({ start: 540, end: 795 })
                .expect(200);
            await plan(today, [
                { task_uid: high.uid, duration_minutes: 150 },
                { task_uid: low.uid, duration_minutes: 150 },
            ]);
            const cap = await agent.get('/api/planner/capacity').expect(200);
            // No feed: no busy time and no event warning.
            expect(cap.body.busy_minutes).toBe(0);
            expect(cap.body.event_overlaps).toEqual([]);
            expect(cap.body.capacity_minutes).toBe(255 - 10);
            expect(cap.body.factor).toBe(1.3);
            expect(cap.body.unrealistic).toBe(true);
            expect(cap.body.move_suggestions).toEqual([low.uid]);
            expect(await planUids(today)).toHaveLength(2);
        });

        it('uses the median of 30 finished Focus sessions as f', async () => {
            const task = await makeTask();
            const started = new Date('2026-01-01T08:00:00Z');
            await LtdFocusSession.bulkCreate(
                Array.from({ length: 30 }, () => ({
                    user_id: user.id,
                    task_id: task.id,
                    started_at: started,
                    ended_at: started,
                    planned_minutes: 20,
                    actual_minutes: 30,
                }))
            );
            const cap = await agent.get('/api/planner/capacity').expect(200);
            expect(cap.body.factor).toBe(1.5);
        });
    });

    describe('T-502 Focus', () => {
        it('interrupting at minute 12 saves the note; resume reopens the task and note', async () => {
            const task = await makeTask({
                name: 'Draft chapter',
                starter_step: 'Reread the last paragraph',
            });
            const t0 = new Date('2026-10-11T09:00:00Z');
            const session = await focus.start(
                user.id,
                { task_uid: task.uid, planned_minutes: 25 },
                t0
            );
            const t12 = new Date(t0.getTime() + 12 * 60000);
            const ended = await focus.end(
                user.id,
                session.uid,
                { interrupted: true, resume_note: 'Halfway through section 2' },
                t12
            );
            expect(ended).toMatchObject({
                interrupted: true,
                actual_minutes: 12,
                resume_note: 'Halfway through section 2',
            });
            const current = await agent
                .get('/api/focus-sessions/current')
                .expect(200);
            expect(current.body.session).toMatchObject({
                uid: session.uid,
                task_uid: task.uid,
                interrupted: true,
                resume_note: 'Halfway through section 2',
            });
            const resumed = await agent
                .post(`/api/focus-sessions/${session.uid}/resume`)
                .send({})
                .expect(201);
            expect(resumed.body.session).toMatchObject({
                task_uid: task.uid,
                task_name: 'Draft chapter',
                starter_step: 'Reread the last paragraph',
                resume_note: 'Halfway through section 2',
                interrupted: false,
                ended_at: null,
            });
            // The interruption stays recorded.
            const old = await LtdFocusSession.findOne({
                where: { uid: session.uid },
            });
            expect(old.interrupted).toBe(true);
            await agent
                .post(`/api/focus-sessions/${resumed.body.session.uid}/end`)
                .send({})
                .expect(200);
            const after = await agent
                .get('/api/focus-sessions/current')
                .expect(200);
            expect(after.body.session).toBeNull();
        });

        it('is owner-scoped', async () => {
            const foreign = await Task.create({
                name: 'Not mine',
                user_id: other.id,
            });
            await agent
                .post('/api/focus-sessions')
                .send({ task_uid: foreign.uid })
                .expect(404);
            const mine = await makeTask();
            const s = await focus.start(other.id, {
                task_uid: (await Task.create({ name: 'b', user_id: other.id }))
                    .uid,
            });
            await agent
                .post(`/api/focus-sessions/${s.uid}/end`)
                .send({})
                .expect(404);
            await agent
                .post('/api/focus-sessions')
                .send({ task_uid: mine.uid, planned_minutes: 0 })
                .expect(400);
            expect(
                await LtdFocusSession.count({ where: { user_id: user.id } })
            ).toBe(0);
        });
    });

    describe('T-504 Recovery and Overwhelmed', () => {
        it('keeps at most three short tasks within 60% of the rest of the day', async () => {
            const tasks = [];
            for (const minutes of [5, 10, 15, 60, 90]) {
                tasks.push(
                    await makeTask({
                        name: `T${minutes}`,
                        estimated_minutes: minutes,
                    })
                );
            }
            await plan(
                today,
                tasks.map((t) => ({ task_uid: t.uid }))
            );
            // 14:00 with a 09:00-17:00 window: 0.6 x 180 = 108 minutes.
            const result = await planner.recover(user, today, actor(user), {
                nowMinute: 840,
            });
            expect(result.capacity_rest_minutes).toBe(108);
            expect(result.kept).toEqual(tasks.slice(0, 3).map((t) => t.uid));
            expect(result.moved).toEqual(tasks.slice(3).map((t) => t.uid));
            expect(await planUids(today)).toEqual(result.kept);
            expect(await planUids(tomorrow)).toEqual(result.moved);
        });

        it('moves through the Journal and Undo restores both days exactly', async () => {
            const a = await makeTask({ name: 'A', estimated_minutes: 120 });
            const b = await makeTask({ name: 'B', estimated_minutes: 120 });
            const c = await makeTask({ name: 'C', estimated_minutes: 120 });
            const done = await makeTask({
                name: 'Done',
                status: Task.STATUS.DONE,
            });
            const existing = await makeTask({ name: 'Tomorrow' });
            await plan(today, [
                { task_uid: a.uid, start_minute: 600 },
                { task_uid: b.uid },
                { task_uid: c.uid },
                { task_uid: done.uid },
            ]);
            await plan(tomorrow, [{ task_uid: existing.uid }]);
            const res = await agent
                .post('/api/planner/recovery')
                .send({})
                .expect(200);
            expect(res.body.kept.length).toBeLessThanOrEqual(3);
            expect([...res.body.kept, ...res.body.moved].sort()).toEqual(
                [a.uid, b.uid, c.uid].sort()
            );
            expect(await planUids(today)).toEqual(
                expect.arrayContaining([done.uid, ...res.body.kept])
            );
            expect(await planUids(tomorrow)).toEqual([
                existing.uid,
                ...res.body.moved,
            ]);
            const entry = await LtdJournal.findOne({
                where: { uid: res.body.journal_uid },
            });
            expect(entry).toMatchObject({
                op: 'recovery',
                entity_type: 'daily_plan',
                actor_type: 'user',
            });
            await agent
                .post(`/api/journal/${res.body.journal_uid}/revert`)
                .send({})
                .expect(200);
            expect(await planUids(today)).toEqual([
                a.uid,
                b.uid,
                c.uid,
                done.uid,
            ]);
            const restored = await agent
                .get(`/api/daily-plan?date=${today}`)
                .expect(200);
            expect(restored.body.plan.items[0].start_minute).toBe(600);
            expect(await planUids(tomorrow)).toEqual([existing.uid]);
            await agent
                .post(`/api/journal/${res.body.journal_uid}/revert`)
                .send({})
                .expect(409);
        });

        it('does nothing and journals nothing when there is nothing to move', async () => {
            const small = await makeTask({ estimated_minutes: 10 });
            await plan(today, [{ task_uid: small.uid }]);
            const before = await LtdJournal.count();
            const res = await agent
                .post('/api/planner/recovery')
                .send({})
                .expect(200);
            expect(res.body).toMatchObject({
                journal_uid: null,
                moved: [],
                kept: [small.uid],
            });
            expect(await LtdJournal.count()).toBe(before);
            expect(await planUids(tomorrow)).toEqual([]);
        });

        it('refuses Undo after the plan changed again', async () => {
            const a = await makeTask({ estimated_minutes: 200 });
            const b = await makeTask({ estimated_minutes: 200 });
            await plan(today, [{ task_uid: a.uid }, { task_uid: b.uid }]);
            const result = await planner.recover(user, today, actor(user), {
                nowMinute: 840,
            });
            await plan(today, []);
            const refused = await agent
                .post(`/api/journal/${result.journal_uid}/revert`)
                .send({})
                .expect(409);
            expect(refused.body.error).toMatch(/changed/);
            expect(await planUids(today)).toEqual([]);
        });

        it('Overwhelmed mutes push until switched off', async () => {
            const list = jest.spyOn(pushRepository, 'listForUser');
            const on = await agent
                .put('/api/planner/overwhelmed')
                .send({ on: true })
                .expect(200);
            expect(on.body.on).toBe(true);
            expect(
                await push.sendToUser(user.id, { title: 'x', body: 'y' })
            ).toBe(0);
            expect(list).not.toHaveBeenCalled();
            list.mockRestore();
            expect(
                planner.overwhelmedActive({
                    overwhelmed: { until: '2000-01-01T00:00:00Z' },
                })
            ).toBe(false);
            const off = await agent
                .put('/api/planner/overwhelmed')
                .send({ on: false })
                .expect(200);
            expect(off.body).toEqual({ on: false, until: null });
            await agent
                .put('/api/planner/overwhelmed')
                .send({ on: 'yes' })
                .expect(400);
        });
    });

    describe('T-505 contribution', () => {
        it('groups done minutes by goal and shows unaligned work as normal', async () => {
            const year = await Goal.create({
                user_id: user.id,
                title: 'Spanish B1',
                horizon: 'year',
            });
            const season = await Goal.create({
                user_id: user.id,
                title: 'Exam prep',
                horizon: 'season',
                parent_goal_id: year.id,
            });
            const aligned = await makeTask({
                name: 'Flashcards',
                goal_id: season.id,
                estimated_minutes: 30,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
            });
            const loose = await makeTask({ name: 'Laundry' });
            await LtdFocusSession.create({
                user_id: user.id,
                task_id: loose.id,
                started_at: new Date(),
                ended_at: new Date(),
                planned_minutes: 25,
                actual_minutes: 45,
            });
            const res = await agent
                .get('/api/planner/contribution')
                .expect(200);
            expect(res.body.goals).toEqual([
                expect.objectContaining({
                    goal_uid: season.uid,
                    title: 'Exam prep',
                    minutes: 30,
                    tasks: 1,
                    chain: [
                        expect.objectContaining({ title: 'Exam prep' }),
                        expect.objectContaining({ title: 'Spanish B1' }),
                    ],
                }),
            ]);
            expect(res.body.unaligned_minutes).toBe(45);
            expect(aligned.uid).toBeTruthy();
        });
    });
});
