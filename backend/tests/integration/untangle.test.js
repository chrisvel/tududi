const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { getConfig } = require('../../config/config');
const { Area, Goal, Project, Task, Person, Tag } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const untangle = require('../../modules/untangle/service');

const config = getConfig();

const reply = (content) => ({
    choices: [{ message: { content: JSON.stringify(content) } }],
    model: 'test-model',
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const today = () => moment.utc().format('YYYY-MM-DD');
const inDays = (n) => moment.utc().add(n, 'days').format('YYYY-MM-DD');

const modelAnswer = () => ({
    today: {
        title: 'Call the landlord about the deposit',
        reason: 'Someone is waiting on you.',
    },
    drop: [
        { title: 'Learn piano', reason: 'No date, no pressure.' },
        { title: 'Read Atomic Habits', reason: 'Nice to have.' },
    ],
    question: {
        text: 'Is the Crete trip this month or someday?',
        options: ['This month', 'Someday'],
    },
    areas: [
        {
            name: 'Home',
            goal: { title: 'Settle the flat', why: 'Deposit and taxes' },
            projects: [
                {
                    name: 'Taxes',
                    tasks: [
                        {
                            title: 'Gather receipts',
                            due: inDays(2),
                            minutes: 60,
                        },
                        {
                            title: 'File the return',
                            due: inDays(20),
                            minutes: 120,
                        },
                    ],
                },
            ],
            items: [
                {
                    title: 'Call the landlord about the deposit',
                    kind: 'waiting',
                    due: today(),
                    person: 'Landlord',
                    minutes: 15,
                    habit_period: null,
                    habit_times: 0,
                },
                {
                    title: 'Insurance renewal',
                    kind: 'task',
                    due: '2020-01-01',
                    person: null,
                    minutes: 37,
                    habit_period: null,
                    habit_times: 0,
                },
            ],
        },
        {
            name: 'Health',
            goal: null,
            projects: [],
            items: [
                {
                    title: 'Gym',
                    kind: 'habit',
                    due: null,
                    person: null,
                    minutes: 60,
                    habit_period: 'weekly',
                    habit_times: 3,
                },
                {
                    title: 'Learn piano',
                    kind: 'someday',
                    due: inDays(1),
                    person: null,
                    minutes: 60,
                    habit_period: null,
                    habit_times: 0,
                },
            ],
        },
        { name: 'Empty', goal: null, projects: [], items: [] },
    ],
});

describe('Untangle', () => {
    beforeEach(() => {
        process.env.LLM_API_KEY = 'test-key';
        config.untangle.enabled = true;
        config.untangle.dailyCap = 500;
        untangle.resetDailyCounter();
        mockCreate.mockReset();
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));
    });

    afterEach(() => {
        delete process.env.LLM_API_KEY;
        delete process.env.LLM_VISION_MODEL;
        config.untangle.enabled = false;
    });

    it('is invisible when switched off or when no provider is configured', async () => {
        config.untangle.enabled = false;
        expect((await request(app).get('/api/untangle/status')).status).toBe(
            404
        );
        expect(
            (await request(app).post('/api/untangle/parse').send({ text: 'x' }))
                .status
        ).toBe(404);

        config.untangle.enabled = true;
        const legacyKey = process.env.OPENAI_API_KEY;
        delete process.env.LLM_API_KEY;
        delete process.env.OPENAI_API_KEY;
        try {
            expect(
                (await request(app).get('/api/untangle/status')).status
            ).toBe(404);
        } finally {
            if (legacyKey !== undefined) process.env.OPENAI_API_KEY = legacyKey;
        }
    });

    it('answers status when on', async () => {
        const res = await request(app).get('/api/untangle/status');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ available: true });
    });

    it('refuses an empty paste', async () => {
        const res = await request(app).post('/api/untangle/parse').send({});
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('parses text into a sanitized structure with a week and a signed token', async () => {
        mockCreate.mockResolvedValue(reply(modelAnswer()));

        const res = await request(app).post('/api/untangle/parse').send({
            text: 'call landlord re deposit!!\ntaxes :(\ngym x3\npiano?',
            timezone: 'UTC',
        });
        expect(res.status).toBe(200);

        const { result, token } = res.body;
        expect(typeof token).toBe('string');
        expect(untangle.verifyToken(token)).toEqual(result);

        // The empty area is dropped, the others kept in order
        expect(result.areas.map((a) => a.name)).toEqual(['Home', 'Health']);
        expect(result.areas[0].goal.title).toBe('Settle the flat');
        expect(result.areas[0].projects[0].tasks).toHaveLength(2);

        const home = result.areas[0].items;
        expect(home[0].kind).toBe('waiting');
        expect(home[0].person).toBe('Landlord');
        // A past due date is pulled up to today, minutes snap to the grid
        expect(home[1].due).toBe(today());
        expect(home[1].minutes).toBe(30);

        const health = result.areas[1].items;
        expect(health[0]).toMatchObject({
            kind: 'habit',
            habit_period: 'weekly',
            habit_times: 3,
        });
        // Someday items never carry a date
        expect(health[1].due).toBeNull();

        expect(result.today.title).toBe('Call the landlord about the deposit');
        expect(result.drop).toHaveLength(2);
        expect(result.question.options).toEqual(['This month', 'Someday']);

        expect(result.week).toHaveLength(7);
        expect(result.week[0].date).toBe(today());
        // Today carries the overdue insurance task (30) but not the waiting one
        expect(result.week[0].minutes).toBe(30);
        expect(result.week[2].minutes).toBe(60);
        const total = result.week.reduce((n, d) => n + d.minutes, 0);
        // 60 + 30 dated; the return is past the window; nothing undated
        expect(total).toBe(90);

        // What went to the provider
        const params = mockCreate.mock.calls[0][0];
        expect(params.messages[0].role).toBe('system');
        expect(params.messages[1].content).toContain(
            'call landlord re deposit'
        );
        expect(params.messages[1].content).toContain(`Today: ${today()}`);
        expect(params.response_format.json_schema.name).toBe('untangle');
    });

    it('sends a screenshot as an image part, with the vision model when set', async () => {
        process.env.LLM_VISION_MODEL = 'vision-model';
        mockCreate.mockResolvedValue(reply(modelAnswer()));
        const image = `data:image/png;base64,${Buffer.from('png').toString('base64')}`;

        const res = await request(app)
            .post('/api/untangle/parse')
            .send({ image, timezone: 'UTC' });
        expect(res.status).toBe(200);

        const params = mockCreate.mock.calls[0][0];
        expect(params.model).toBe('vision-model');
        const content = params.messages[1].content;
        expect(Array.isArray(content)).toBe(true);
        expect(content[1]).toEqual({
            type: 'image_url',
            image_url: { url: image },
        });
    });

    it('refuses an image that is not a PNG, JPEG or WebP data URL', async () => {
        const res = await request(app)
            .post('/api/untangle/parse')
            .send({ image: 'data:text/html;base64,PGI+' });
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('passes earlier answers back to the model', async () => {
        mockCreate.mockResolvedValue(reply(modelAnswer()));
        await request(app)
            .post('/api/untangle/parse')
            .send({
                text: 'crete??',
                answers: [
                    { question: 'Is Crete this month?', answer: 'Someday' },
                ],
            });
        const content = mockCreate.mock.calls[0][0].messages[1].content;
        expect(content).toContain('Answers to earlier questions');
        expect(content).toContain('Is Crete this month? Someday');
    });

    it('answers 502 when the model returns nothing usable', async () => {
        mockCreate.mockResolvedValue(reply({ areas: [] }));
        const res = await request(app)
            .post('/api/untangle/parse')
            .send({ text: 'hello' });
        expect(res.status).toBe(502);
        expect(res.body.code).toBe('AI_NO_ANSWER');
    });

    it('hides provider errors behind a generic 502', async () => {
        mockCreate.mockRejectedValue(
            new Error('401 Incorrect API key provided: sk-secret')
        );
        const res = await request(app)
            .post('/api/untangle/parse')
            .send({ text: 'hello' });
        expect(res.status).toBe(502);
        expect(res.body.code).toBe('AI_UNAVAILABLE');
        expect(JSON.stringify(res.body)).not.toContain('sk-secret');
    });

    it('stops at the daily cap', async () => {
        config.untangle.dailyCap = 1;
        mockCreate.mockResolvedValue(reply(modelAnswer()));
        expect(
            (await request(app).post('/api/untangle/parse').send({ text: 'a' }))
                .status
        ).toBe(200);
        expect(
            (await request(app).post('/api/untangle/parse').send({ text: 'b' }))
                .status
        ).toBe(503);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    describe('keep', () => {
        let user, agent;

        beforeEach(async () => {
            user = await createTestUser({
                email: `untangle-${Date.now()}@example.com`,
                timezone: 'UTC',
                onboarding_starter: null,
            });
            agent = request.agent(app);
            await agent
                .post('/api/login')
                .send({ email: user.email, password: 'password123' });
        });

        const parsed = () =>
            untangle.sanitizeResult(modelAnswer(), { timezone: 'UTC' });

        it('needs a session', async () => {
            const token = untangle.signResult(parsed());
            const res = await request(app)
                .post('/api/untangle/keep')
                .send({ token });
            expect(res.status).toBe(401);
        });

        it('refuses a token it did not sign', async () => {
            const token = untangle.signResult(parsed());
            const [payload] = token.split('.');
            const forged = `${payload}.${'a'.repeat(43)}`;
            const res = await agent.post('/api/untangle/keep').send({
                token: forged,
            });
            expect(res.status).toBe(400);
            expect(await Area.count({ where: { user_id: user.id } })).toBe(0);
        });

        it('seeds the account from the token and marks onboarding done', async () => {
            const token = untangle.signResult(parsed());
            const res = await agent.post('/api/untangle/keep').send({ token });
            expect(res.status).toBe(200);
            expect(res.body.onboarding_starter).toBe('untangle');
            expect(res.body.onboarded_at).toBeTruthy();
            expect(res.body.created).toEqual({
                areas: 2,
                goals: 1,
                projects: 1,
                tasks: 5,
                habits: 1,
                people: 1,
            });

            const areas = await Area.findAll({
                where: { user_id: user.id },
                order: [['id', 'ASC']],
            });
            expect(areas.map((a) => a.name)).toEqual(['Home', 'Health']);

            const goal = await Goal.findOne({ where: { user_id: user.id } });
            expect(goal.title).toBe('Settle the flat');
            expect(goal.area_id).toBe(areas[0].id);

            const project = await Project.findOne({
                where: { user_id: user.id },
            });
            expect(project.name).toBe('Taxes');
            expect(project.goal_id).toBe(goal.id);
            expect(
                await Task.count({
                    where: { user_id: user.id, project_id: project.id },
                })
            ).toBe(2);

            const waiting = await Task.findOne({
                where: {
                    user_id: user.id,
                    name: 'Call the landlord about the deposit',
                },
            });
            expect(waiting.status).toBe(Task.STATUS.WAITING);
            const landlord = await Person.findOne({
                where: { user_id: user.id, name: 'Landlord' },
            });
            expect(waiting.assigned_to).toBe(landlord.uid);

            const habit = await Task.findOne({
                where: { user_id: user.id, name: 'Gym' },
            });
            expect(habit.habit_mode).toBe(true);
            expect(habit.habit_target_count).toBe(3);
            expect(habit.habit_frequency_period).toBe('weekly');

            const piano = await Task.findOne({
                where: { user_id: user.id, name: 'Learn piano' },
                include: [{ model: Tag }],
            });
            expect(piano.due_date).toBeNull();
            expect(piano.Tags.map((t) => t.name)).toEqual(['someday']);
        });

        it('reuses same-name areas, projects, habits and people on a second run', async () => {
            const token = untangle.signResult(parsed());
            await agent.post('/api/untangle/keep').send({ token });
            const res = await agent.post('/api/untangle/keep').send({ token });
            expect(res.status).toBe(200);
            expect(res.body.created).toMatchObject({
                areas: 0,
                goals: 0,
                projects: 0,
                habits: 0,
                people: 0,
            });
            expect(await Area.count({ where: { user_id: user.id } })).toBe(2);
            expect(
                await Person.count({
                    where: { user_id: user.id, name: 'Landlord' },
                })
            ).toBe(1);
        });
    });
});
