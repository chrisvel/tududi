const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { Task, DailyPlan, DailyPlanItem } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Issue #1821: habits that had ever been checked in disappeared from the
// planner, Upcoming and All tasks.
describe('Habits in task lists', () => {
    let agent;
    const today = moment.utc().format('YYYY-MM-DD');
    const weekday = moment.utc().day();
    const daysAgo = (n) =>
        moment.utc().subtract(n, 'days').hour(12).toISOString();

    beforeEach(async () => {
        await createTestUser({
            email: 'habit-lists@example.com',
            timezone: 'UTC',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'habit-lists@example.com',
            password: 'password123',
        });
    });

    const create = async (body) => {
        const res = await agent.post('/api/habits').send(body);
        expect(res.status).toBe(201);
        return res.body.habit;
    };

    const checkIn = async (habit, completedAt) => {
        const res = await agent
            .post(`/api/habits/${habit.uid}/complete`)
            .send(completedAt ? { completed_at: completedAt } : {});
        expect(res.status).toBe(200);
    };

    // One habit of each kind, most of them checked in before.
    const createHabits = async () => {
        const water = await create({ name: 'Water' });
        await checkIn(water, daysAgo(40));
        await checkIn(water, daysAgo(1));

        const run = await create({
            name: 'Run',
            habit_frequency_period: 'weekly',
            habit_target_count: 2,
        });
        await checkIn(run, daysAgo(40));

        const clean = await create({
            name: 'Clean',
            habit_frequency_period: 'weekly',
        });
        await checkIn(clean, daysAgo(40));

        const budget = await create({
            name: 'Budget',
            habit_frequency_period: 'monthly',
        });
        await checkIn(budget, daysAgo(40));

        const call = await create({
            name: 'Call home',
            habit_frequency_period: 'interval',
            habit_interval_days: 3,
        });
        await checkIn(call, daysAgo(40));

        await create({ name: 'Stretch' });

        const reading = await create({
            name: 'Read',
            habit_target_value: 20,
            habit_unit: 'pages',
        });
        const res = await agent
            .post(`/api/habits/${reading.uid}/complete`)
            .send({ completed_at: daysAgo(40), value: 20 });
        expect(res.status).toBe(200);

        // Not asking for a check-in today.
        const meditate = await create({ name: 'Meditate' });
        await checkIn(meditate);
        const laundry = await create({
            name: 'Laundry',
            habit_frequency_period: 'weekly',
        });
        await checkIn(laundry);
        await create({
            name: 'Gym',
            habit_schedule_days: [0, 1, 2, 3, 4, 5, 6].filter(
                (d) => d !== weekday
            ),
        });
        await create({ name: 'No sugar', habit_polarity: 'quit' });

        return { meditate, laundry };
    };

    // Task lists show recurring tasks under their recurrence label.
    const nameOf = (task) => task.original_name ?? task.name;

    const DUE_TODAY = [
        'Water',
        'Run',
        'Clean',
        'Budget',
        'Call home',
        'Stretch',
        'Read',
    ];
    const NOT_DUE_TODAY = ['Meditate', 'Laundry', 'Gym', 'No sugar'];

    it('keeps checked-in habits open', async () => {
        await createHabits();
        const done = await Task.count({
            where: { habit_mode: true, status: Task.STATUS.DONE },
        });
        expect(done).toBe(0);
    });

    it('suggests every habit that asks for a check-in today in the planner', async () => {
        await createHabits();
        const res = await agent.get('/api/daily-plan/candidates');
        expect(res.status).toBe(200);
        const names = res.body.suggested.map((task) => task.name);

        expect(names).toEqual(expect.arrayContaining(DUE_TODAY));
        for (const name of NOT_DUE_TODAY) {
            expect(names).not.toContain(name);
        }
    });

    it('lists habits in Upcoming on the days they ask for a check-in', async () => {
        await createHabits();
        const res = await agent.get('/api/tasks').query({
            type: 'upcoming',
            groupBy: 'day',
            maxDays: 7,
            client_side_filtering: 'true',
            include_subtasks: 'true',
        });
        expect(res.status).toBe(200);

        const days = (name) =>
            res.body.tasks
                .filter((task) => nameOf(task) === name)
                .map((task) => {
                    expect(task.status).not.toBe(Task.STATUS.DONE);
                    return String(task.due_date).slice(0, 10);
                });

        for (const name of DUE_TODAY) {
            expect(days(name)).toContain(today);
        }
        expect(days('Water')).toHaveLength(7);
        for (const name of NOT_DUE_TODAY) {
            expect(days(name)).not.toContain(today);
        }

        // Done for today, back tomorrow.
        const tomorrow = moment.utc().add(1, 'day').format('YYYY-MM-DD');
        expect(days('Meditate')[0]).toBe(tomorrow);
        // The weekly goal is met, so not before next week.
        const nextWeek = moment
            .utc()
            .startOf('isoWeek')
            .add(7, 'days')
            .format('YYYY-MM-DD');
        expect(days('Laundry').every((day) => day >= nextWeek)).toBe(true);
        // Scheduled days only.
        expect(days('Gym')).toHaveLength(6);
        expect(days('No sugar')).toHaveLength(0);
    });

    it('lists every open habit in All tasks', async () => {
        await createHabits();
        const res = await agent
            .get('/api/tasks')
            .query({ type: 'all', status: 'active' });
        expect(res.status).toBe(200);
        const names = res.body.tasks.map(nameOf);
        expect(names).toEqual(
            expect.arrayContaining([...DUE_TODAY, ...NOT_DUE_TODAY])
        );
    });

    it('shows a planned habit as done once it is checked in today', async () => {
        const { meditate } = await createHabits();
        const stretch = await Task.findOne({ where: { name: 'Stretch' } });
        const plan = await DailyPlan.create({
            user_id: stretch.user_id,
            plan_date: today,
        });
        const row = await Task.findOne({ where: { uid: meditate.uid } });
        await DailyPlanItem.bulkCreate([
            { daily_plan_id: plan.id, task_id: row.id, position: 0 },
            { daily_plan_id: plan.id, task_id: stretch.id, position: 1 },
        ]);

        const res = await agent.get('/api/daily-plan').query({ date: today });
        expect(res.status).toBe(200);
        const done = Object.fromEntries(
            res.body.plan.items.map((item) => [
                item.task.name,
                item.occurrence_done,
            ])
        );
        expect(done).toEqual({ Meditate: true, Stretch: false });
    });
});
