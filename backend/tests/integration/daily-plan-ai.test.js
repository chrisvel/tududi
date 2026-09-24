const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { Task, User, DailyPlan } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const dailyPlanAi = require('../../modules/daily-plan/ai');

const reply = (content) => ({
    choices: [{ message: { content: JSON.stringify(content) } }],
    model: 'test-model',
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

describe('Daily plan AI routes', () => {
    let user, agent, today;

    beforeEach(async () => {
        process.env.LLM_API_KEY = 'test-key';
        mockCreate.mockReset();
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));
        dailyPlanAi.clearEstimateCache();

        user = await createTestUser({
            email: `plan-ai-${Date.now()}@example.com`,
            timezone: 'UTC',
        });
        await User.update(
            { features: { ai_assistant_enabled: true } },
            { where: { id: user.id } }
        );
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        today = moment.utc().format('YYYY-MM-DD');
    });

    afterEach(() => {
        delete process.env.LLM_API_KEY;
    });

    const dueToday = (name, extra = {}) =>
        Task.create({
            name,
            user_id: user.id,
            due_date: moment.utc().endOf('day').toDate(),
            ...extra,
        });

    it('refuses every AI helper while the AI assistant is off', async () => {
        await User.update(
            { features: { ai_assistant_enabled: false } },
            { where: { id: user.id } }
        );

        const draft = await agent.post('/api/daily-plan/ai/draft').send({});
        const estimates = await agent
            .post('/api/daily-plan/ai/estimates')
            .send({ task_uids: [] });
        const wrapUp = await agent.post(`/api/daily-plan/${today}/ai/wrap-up`);

        expect([draft.status, estimates.status, wrapUp.status]).toEqual([
            403, 403, 403,
        ]);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns a sanitised draft without saving it', async () => {
        const a = await dueToday('Pay invoice', { estimated_minutes: 15 });
        mockCreate.mockResolvedValue(
            reply({
                summary: 'Light day',
                items: [
                    {
                        task_uid: a.uid,
                        start_minute: null,
                        duration_minutes: 0,
                        reason: 'Due today',
                    },
                    {
                        task_uid: 'made-up',
                        start_minute: 600,
                        duration_minutes: 30,
                        reason: 'x',
                    },
                ],
                skipped: [],
            })
        );

        const res = await agent
            .post('/api/daily-plan/ai/draft')
            .send({ mode: 'fill' });

        expect(res.status).toBe(200);
        expect(res.body.summary).toBe('Light day');
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]).toMatchObject({
            task_uid: a.uid,
            duration_minutes: 15,
            reason: 'Due today',
        });
        expect(res.body.items[0].task.name).toBe('Pay invoice');
        expect(await DailyPlan.count()).toBe(0);
    });

    it('estimates once and serves repeats from the cache', async () => {
        const a = await Task.create({ name: 'Write report', user_id: user.id });
        mockCreate.mockResolvedValue(
            reply({ estimates: [{ task_uid: a.uid, minutes: 100 }] })
        );

        const first = await agent
            .post('/api/daily-plan/ai/estimates')
            .send({ task_uids: [a.uid] });
        const second = await agent
            .post('/api/daily-plan/ai/estimates')
            .send({ task_uids: [a.uid] });

        expect(first.body.estimates).toEqual([
            { task_uid: a.uid, minutes: 105 },
        ]);
        expect(second.body.estimates).toEqual(first.body.estimates);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('stores the wrap-up with the plan and carries tasks to tomorrow', async () => {
        const done = await dueToday('Done thing', { status: 2 });
        const open = await dueToday('Open thing');
        await agent.put(`/api/daily-plan/${today}`).send({
            items: [{ task_uid: done.uid }, { task_uid: open.uid }],
        });
        mockCreate.mockResolvedValue(
            reply({
                summary: 'Half done',
                wins: ['Done thing'],
                carry_over: [
                    { task_uid: open.uid, reason: 'Still needed' },
                    { task_uid: done.uid, reason: 'Already done' },
                ],
                pattern: '',
            })
        );

        const res = await agent.post(`/api/daily-plan/${today}/ai/wrap-up`);

        expect(res.status).toBe(200);
        expect(res.body.wrap_up.carry_over.map((c) => c.task_uid)).toEqual([
            open.uid,
        ]);
        const plan = await agent.get('/api/daily-plan');
        expect(plan.body.plan.ai_wrap_up.summary).toBe('Half done');

        const tomorrow = moment.utc().add(1, 'day').format('YYYY-MM-DD');
        const carried = await agent
            .post(`/api/daily-plan/${tomorrow}/carry-over`)
            .send({ task_uids: [open.uid] });
        const again = await agent
            .post(`/api/daily-plan/${tomorrow}/carry-over`)
            .send({ task_uids: [open.uid] });

        expect(carried.status).toBe(200);
        expect(again.body.plan.items).toHaveLength(1);
        expect(again.body.plan.items[0]).toMatchObject({
            task_uid: open.uid,
            start_minute: null,
        });
    });
});
