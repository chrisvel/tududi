const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const {
    Task,
    Project,
    InboxItem,
    DailyPlan,
    DailyPlanItem,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Daily plan routes', () => {
    let user, agent, today;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'planner@example.com',
            timezone: 'Europe/Athens',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'planner@example.com',
            password: 'password123',
        });
        today = moment.tz('Europe/Athens').format('YYYY-MM-DD');
    });

    const makeTask = (attrs = {}) =>
        Task.create({ name: 'A task', user_id: user.id, ...attrs });

    it('returns no plan for a day that was never planned', async () => {
        const res = await agent.get('/api/daily-plan');

        expect(res.status).toBe(200);
        expect(res.body.date).toBe(today);
        expect(res.body.plan).toBeNull();
    });

    it('saves items in the order sent, filling durations from the estimate', async () => {
        const first = await makeTask({
            name: 'Write spec',
            estimated_minutes: 60,
        });
        const second = await makeTask({ name: 'Pay invoice' });

        const res = await agent.put(`/api/daily-plan/${today}`).send({
            items: [
                { task_uid: second.uid, start_minute: 600 },
                { task_uid: first.uid, start_minute: 480 },
            ],
        });

        expect(res.status).toBe(200);
        expect(res.body.plan.started_at).toBeNull();
        expect(res.body.plan.items.map((i) => i.task_uid)).toEqual([
            second.uid,
            first.uid,
        ]);
        expect(res.body.plan.items[0].duration_minutes).toBe(30);
        expect(res.body.plan.items[1].duration_minutes).toBe(60);
        expect(res.body.plan.items[1].task.name).toBe('Write spec');
    });

    it('replaces the previous items on every save', async () => {
        const a = await makeTask();
        const b = await makeTask();
        await agent
            .put(`/api/daily-plan/${today}`)
            .send({ items: [{ task_uid: a.uid }, { task_uid: b.uid }] });

        const res = await agent
            .put(`/api/daily-plan/${today}`)
            .send({ items: [{ task_uid: b.uid, start_minute: null }] });

        expect(res.body.plan.items).toHaveLength(1);
        expect(await DailyPlanItem.count()).toBe(1);
    });

    it('rejects overlapping time slots', async () => {
        const a = await makeTask();
        const b = await makeTask();

        const res = await agent.put(`/api/daily-plan/${today}`).send({
            items: [
                { task_uid: a.uid, start_minute: 540, duration_minutes: 60 },
                { task_uid: b.uid, start_minute: 570, duration_minutes: 30 },
            ],
        });

        expect(res.status).toBe(400);
        expect(await DailyPlanItem.count()).toBe(0);
    });

    it('rejects a slot that runs past midnight', async () => {
        const a = await makeTask();

        const res = await agent.put(`/api/daily-plan/${today}`).send({
            items: [
                { task_uid: a.uid, start_minute: 1410, duration_minutes: 60 },
            ],
        });

        expect(res.status).toBe(400);
    });

    it('rejects the same task twice', async () => {
        const a = await makeTask();

        const res = await agent
            .put(`/api/daily-plan/${today}`)
            .send({ items: [{ task_uid: a.uid }, { task_uid: a.uid }] });

        expect(res.status).toBe(400);
    });

    it("does not let a user plan someone else's task", async () => {
        const other = await createTestUser({ email: 'not-mine@example.com' });
        const foreign = await Task.create({
            name: 'Private',
            user_id: other.id,
        });

        const res = await agent
            .put(`/api/daily-plan/${today}`)
            .send({ items: [{ task_uid: foreign.uid }] });

        expect(res.status).toBe(404);
        expect(await DailyPlanItem.count()).toBe(0);
    });

    it('rejects a malformed date', async () => {
        const res = await agent
            .put('/api/daily-plan/24-09-2026')
            .send({ items: [] });

        expect(res.status).toBe(400);
    });

    it('starts the day and keeps the first start time', async () => {
        const a = await makeTask();
        await agent
            .put(`/api/daily-plan/${today}`)
            .send({ items: [{ task_uid: a.uid }] });

        const started = await agent.post(`/api/daily-plan/${today}/start`);
        const again = await agent.post(`/api/daily-plan/${today}/start`);

        expect(started.status).toBe(200);
        expect(started.body.plan.started_at).toBeTruthy();
        expect(again.body.plan.started_at).toBe(started.body.plan.started_at);
    });

    it('clears a plan', async () => {
        const a = await makeTask();
        await agent
            .put(`/api/daily-plan/${today}`)
            .send({ items: [{ task_uid: a.uid }] });

        const res = await agent.delete(`/api/daily-plan/${today}`);

        expect(res.status).toBe(200);
        expect(await DailyPlan.count()).toBe(0);
        expect(await DailyPlanItem.count()).toBe(0);
    });

    it('lists candidates grouped once each, plus open inbox items', async () => {
        const yesterday = moment
            .tz('Europe/Athens')
            .subtract(3, 'days')
            .format('YYYY-MM-DD');
        const overdue = await agent
            .post('/api/task')
            .send({ name: 'Renew insurance', due_date: yesterday });
        await InboxItem.create({
            content: 'Call the plumber',
            source: 'web',
            user_id: user.id,
        });

        const res = await agent.get('/api/daily-plan/candidates');

        expect(res.status).toBe(200);
        expect(res.body.overdue.map((t) => t.uid)).toContain(overdue.body.uid);
        const allUids = [
            ...res.body.in_progress,
            ...res.body.overdue,
            ...res.body.due_today,
            ...res.body.suggested,
        ].map((t) => t.uid);
        expect(new Set(allUids).size).toBe(allUids.length);
        expect(res.body.inbox_count).toBe(1);
        expect(res.body.inbox[0].content).toBe('Call the plumber');
    });

    it('ranks candidates: overdue first, then project tasks, then priority', async () => {
        const project = await Project.create({
            name: 'Home',
            user_id: user.id,
        });
        const lastWeek = moment
            .tz('Europe/Athens')
            .subtract(7, 'days')
            .format('YYYY-MM-DD');
        const startedLate = await makeTask({
            name: 'Started but late',
            status: Task.STATUS.IN_PROGRESS,
            due_date: lastWeek,
        });
        const looseLow = await makeTask({ name: 'Loose low', priority: 0 });
        const looseHigh = await makeTask({ name: 'Loose high', priority: 2 });
        const projectLow = await makeTask({
            name: 'Project low',
            priority: 0,
            project_id: project.id,
        });
        const projectHigh = await makeTask({
            name: 'Project high',
            priority: 2,
            project_id: project.id,
        });

        const res = await agent.get('/api/daily-plan/candidates');

        expect(res.status).toBe(200);
        expect(res.body.overdue.map((t) => t.uid)).toEqual([startedLate.uid]);
        expect(res.body.in_progress).toEqual([]);
        expect(res.body.ranked).toEqual([
            startedLate.uid,
            projectHigh.uid,
            projectLow.uid,
            looseHigh.uid,
            looseLow.uid,
        ]);
    });

    it('saves a custom ranking and uses it for candidates', async () => {
        const project = await Project.create({
            name: 'Work',
            user_id: user.id,
        });
        const loose = await makeTask({ name: 'Loose', priority: 0 });
        const inProject = await makeTask({
            name: 'In project',
            priority: 2,
            project_id: project.id,
        });
        await makeTask({ name: 'Filler one' });

        const initial = await agent.get('/api/daily-plan/ranking');
        expect(initial.status).toBe(200);
        expect(initial.body.order).toEqual(initial.body.default_order);

        const order = [
            'suggested:none',
            ...initial.body.default_order.filter(
                (key) => key !== 'suggested:none'
            ),
        ];
        const saved = await agent
            .put('/api/daily-plan/ranking')
            .send({ order });
        expect(saved.status).toBe(200);
        expect(saved.body.order).toEqual(order);

        const res = await agent.get('/api/daily-plan/candidates');
        const ranked = res.body.ranked;
        expect(ranked.indexOf(loose.uid)).toBeLessThan(
            ranked.indexOf(inProject.uid)
        );
    });

    it('keeps the saved ranking when the profile form saves ui_settings', async () => {
        const initial = await agent.get('/api/daily-plan/ranking');
        const order = [...initial.body.default_order].reverse();
        await agent.put('/api/daily-plan/ranking').send({ order });

        const res = await agent.patch('/api/profile').send({
            ui_settings: { appearance: { theme: 'dark' } },
        });
        expect(res.status).toBe(200);

        const after = await agent.get('/api/daily-plan/ranking');
        expect(after.body.order).toEqual(order);
    });

    it('rejects a ranking that does not list every bucket once', async () => {
        const res = await agent
            .put('/api/daily-plan/ranking')
            .send({ order: ['overdue:project', 'overdue:project'] });

        expect(res.status).toBe(400);
    });
});

describe('Task estimated_minutes', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'estimates@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'estimates@example.com',
            password: 'password123',
        });
    });

    it('saves, clears and validates the estimate', async () => {
        const created = await agent
            .post('/api/task')
            .send({ name: 'Estimate me', estimated_minutes: 45 });
        expect(created.body.estimated_minutes).toBe(45);

        const bad = await agent
            .patch(`/api/task/${created.body.uid}`)
            .send({ estimated_minutes: 3 });
        expect(bad.status).toBe(400);

        const cleared = await agent
            .patch(`/api/task/${created.body.uid}`)
            .send({ estimated_minutes: null });
        expect(cleared.status).toBe(200);
        expect(cleared.body.estimated_minutes).toBeNull();
    });
});
