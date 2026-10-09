const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const moment = require('moment-timezone');

describe('Onboarding', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `newcomer_${Date.now()}@example.com`,
        });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it('tells the app a new account has not been onboarded', async () => {
        const res = await agent.get('/api/current_user');

        expect(res.status).toBe(200);
        expect(res.body.user.onboarded_at).toBeNull();
    });

    it('marks the welcome screen done once and keeps the first time', async () => {
        const first = await agent.post('/api/onboarding/complete');
        expect(first.status).toBe(200);
        expect(first.body.onboarded_at).toBeTruthy();

        const second = await agent.post('/api/onboarding/complete');
        expect(second.status).toBe(200);
        expect(second.body.onboarded_at).toBe(first.body.onboarded_at);

        const me = await agent.get('/api/current_user');
        expect(me.body.user.onboarded_at).toBe(first.body.onboarded_at);

        const row = await User.findByPk(user.id);
        expect(row.onboarded_at).not.toBeNull();
    });

    it('requires a session', async () => {
        const res = await request(app).post('/api/onboarding/complete');
        expect(res.status).toBe(401);
    });
});

describe('Onboarding starters', () => {
    const { Area, Goal, Project, Task, Note, Tag } = require('../../models');
    const { resolveDue } = require('../../modules/onboarding/service');
    let user, agent;

    const household = {
        key: 'household',
        areas: [
            {
                name: 'Home',
                color: '#16a34a',
                goal: { title: 'A calmer Sunday evening', horizon: 'season' },
                projects: [
                    {
                        name: 'Fix-ups around the house',
                        tasks: [
                            {
                                name: 'Fix the kitchen tap',
                                due: 'sat',
                                tags: ['home'],
                            },
                        ],
                    },
                ],
                tasks: [
                    { name: 'Call the dentist', due: 'today', tags: ['home'] },
                ],
            },
            {
                name: 'Me',
                color: '#7c3aed',
                goal: null,
                projects: [],
                tasks: [{ name: 'Thirty minutes with a book', due: null }],
            },
        ],
        habits: [
            { name: 'Sunday weekly review', period: 'weekly', days: [0] },
            { name: 'Evening tidy', period: 'daily', days: null },
        ],
        note: { title: 'How this is set up', content: 'Three shelves.' },
    };

    beforeEach(async () => {
        user = await createTestUser({
            email: `starter_${Date.now()}@example.com`,
            timezone: 'Europe/Athens',
        });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it('starts with no starter chosen', async () => {
        const res = await agent.get('/api/current_user');
        expect(res.body.user.onboarding_starter).toBeNull();
    });

    it('seeds a starter and saves the choice', async () => {
        const res = await agent.post('/api/onboarding/starter').send(household);

        expect(res.status).toBe(200);
        expect(res.body.onboarding_starter).toBe('household');
        expect(res.body.onboarded_at).toBeTruthy();
        expect(res.body.created).toEqual({
            areas: 2,
            goals: 1,
            projects: 1,
            tasks: 3,
            habits: 2,
            notes: 1,
        });

        const areas = await Area.findAll({ where: { user_id: user.id } });
        expect(areas.map((a) => a.name).sort()).toEqual(['Home', 'Me']);
        const home = areas.find((a) => a.name === 'Home');
        expect(home.color).toBe('#16a34a');

        const goal = await Goal.findOne({ where: { user_id: user.id } });
        expect(goal.area_id).toBe(home.id);

        const project = await Project.findOne({ where: { user_id: user.id } });
        expect(project.area_id).toBe(home.id);
        expect(project.goal_id).toBe(goal.id);
        expect(project.status).toBe('in_progress');

        const tasks = await Task.findAll({
            where: { user_id: user.id, habit_mode: false },
            include: [{ model: Tag }],
        });
        expect(tasks).toHaveLength(3);
        tasks.forEach((task) => expect(task.example_of).toBe('household'));
        const tap = tasks.find((t) => t.name === 'Fix the kitchen tap');
        expect(tap.project_id).toBe(project.id);
        expect(tap.Tags.map((t) => t.name)).toEqual(['home']);
        const book = tasks.find((t) => t.name === 'Thirty minutes with a book');
        expect(book.due_date).toBeNull();
        expect(book.area_id).toBe(areas.find((a) => a.name === 'Me').id);

        const habits = await Task.findAll({
            where: { user_id: user.id, habit_mode: true },
        });
        expect(habits.map((h) => h.name).sort()).toEqual([
            'Evening tidy',
            'Sunday weekly review',
        ]);
        const review = habits.find((h) => h.name === 'Sunday weekly review');
        expect(review.habit_frequency_period).toBe('weekly');
        expect(review.habit_schedule_days).toEqual([0]);

        expect(await Note.count({ where: { user_id: user.id } })).toBe(1);

        const me = await agent.get('/api/current_user');
        expect(me.body.user.onboarding_starter).toBe('household');
        expect(me.body.user.onboarded_at).toBeTruthy();
    });

    it('reuses areas, projects and habits the account already has', async () => {
        await Area.create({ name: 'home', user_id: user.id });
        await Task.create({
            name: 'Evening tidy',
            user_id: user.id,
            habit_mode: true,
        });

        const res = await agent.post('/api/onboarding/starter').send(household);

        expect(res.status).toBe(200);
        expect(res.body.created.areas).toBe(1);
        expect(res.body.created.habits).toBe(1);
        expect(await Area.count({ where: { user_id: user.id } })).toBe(2);
        const project = await Project.findOne({ where: { user_id: user.id } });
        const home = await Area.findOne({
            where: { user_id: user.id, name: 'home' },
        });
        expect(project.area_id).toBe(home.id);
    });

    it('records "empty" without creating anything', async () => {
        const res = await agent
            .post('/api/onboarding/starter')
            .send({ key: 'empty' });

        expect(res.status).toBe(200);
        expect(res.body.onboarding_starter).toBe('empty');
        expect(res.body.created.tasks).toBe(0);
        expect(await Task.count({ where: { user_id: user.id } })).toBe(0);
        const row = await User.findByPk(user.id);
        expect(row.onboarding_starter).toBe('empty');
        expect(row.onboarded_at).not.toBeNull();
    });

    it('rejects an unknown starter and oversized payloads', async () => {
        const unknown = await agent
            .post('/api/onboarding/starter')
            .send({ key: 'mansion' });
        expect(unknown.status).toBe(400);

        const tooMany = await agent.post('/api/onboarding/starter').send({
            key: 'household',
            areas: Array.from({ length: 7 }, (_, i) => ({ name: `A${i}` })),
        });
        expect(tooMany.status).toBe(400);
        expect(await Area.count({ where: { user_id: user.id } })).toBe(0);
    });

    it('counts and removes untouched examples only', async () => {
        await agent.post('/api/onboarding/starter').send(household);
        const own = await Task.create({ name: 'Mine', user_id: user.id });
        const tap = await Task.findOne({
            where: { user_id: user.id, name: 'Fix the kitchen tap' },
        });
        await tap.update({ status: Task.STATUS.DONE });

        const count = await agent.get('/api/onboarding/examples');
        expect(count.body.count).toBe(2);

        const removed = await agent.delete('/api/onboarding/examples');
        expect(removed.status).toBe(200);
        expect(removed.body.removed).toBe(2);

        const left = await Task.findAll({
            where: { user_id: user.id, habit_mode: false },
        });
        expect(left.map((t) => t.name).sort()).toEqual([
            'Fix the kitchen tap',
            'Mine',
        ]);
        expect((await Task.findByPk(own.id)).example_of).toBeNull();
    });

    it("turns an example into the user's own task on the first edit", async () => {
        await agent.post('/api/onboarding/starter').send(household);
        const dentist = await Task.findOne({
            where: { user_id: user.id, name: 'Call the dentist' },
        });

        const res = await agent
            .patch(`/api/task/${dentist.uid}`)
            .send({ name: 'Call the dentist about the crown' });
        expect(res.status).toBe(200);

        await dentist.reload();
        expect(dentist.example_of).toBeNull();
        const count = await agent.get('/api/onboarding/examples');
        expect(count.body.count).toBe(2);
    });

    it('resolves relative dates in the user timezone and never in the past', () => {
        const tz = 'Europe/Athens';
        const today = moment.tz(tz).startOf('day');
        const asDay = (d) => moment.tz(d, tz).format('YYYY-MM-DD');

        expect(asDay(resolveDue('today', tz))).toBe(today.format('YYYY-MM-DD'));
        expect(asDay(resolveDue('tomorrow', tz))).toBe(
            today.clone().add(1, 'day').format('YYYY-MM-DD')
        );
        expect(asDay(resolveDue('+3d', tz))).toBe(
            today.clone().add(3, 'day').format('YYYY-MM-DD')
        );
        expect(asDay(resolveDue('next-week', tz))).toBe(
            today.clone().add(7, 'day').format('YYYY-MM-DD')
        );
        const sat = moment.tz(resolveDue('sat', tz), tz);
        expect(sat.day()).toBe(6);
        expect(sat.diff(today, 'days')).toBeGreaterThanOrEqual(0);
        expect(sat.diff(today, 'days')).toBeLessThan(7);
        expect(resolveDue('someday', tz)).toBeNull();
        expect(resolveDue(null, tz)).toBeNull();
    });

    it('requires a session', async () => {
        const res = await request(app)
            .post('/api/onboarding/starter')
            .send({ key: 'empty' });
        expect(res.status).toBe(401);
    });
});
