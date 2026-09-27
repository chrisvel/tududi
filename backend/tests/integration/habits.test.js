const request = require('supertest');
const app = require('../../app');
const { Task, User, RecurringCompletion } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    checkHabitReminders,
} = require('../../modules/habits/habitReminderService');
const { Notification } = require('../../models');

describe('Habits Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'habits@example.com' });
        await User.update(
            { timezone: 'Europe/Athens' },
            { where: { id: user.id } }
        );
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'habits@example.com',
            password: 'password123',
        });
    });

    const create = async (body) => {
        const res = await agent.post('/api/habits').send(body);
        expect(res.status).toBe(201);
        return res.body.habit;
    };

    it('creates a habit with progress for the current period', async () => {
        const habit = await create({ name: 'Read', habit_target_count: 3 });
        expect(habit.habit_mode).toBe(true);
        expect(habit.habit_progress).toMatchObject({
            goal: 3,
            progress: 0,
            met: false,
            multiple_per_day: true,
        });
    });

    it('ignores fields outside the habit settings', async () => {
        const other = await createTestUser({
            email: 'habits-other@example.com',
        });
        const habit = await create({ name: 'Walk', user_id: other.id });
        const res = await agent
            .put(`/api/habits/${habit.uid}`)
            .send({ user_id: other.id, habit_mode: false, name: 'Walk more' });
        expect(res.status).toBe(200);
        const row = await Task.findOne({ where: { uid: habit.uid } });
        expect(row.user_id).toBe(user.id);
        expect(row.habit_mode).toBe(true);
        expect(row.name).toBe('Walk more');
    });

    it('stores a palette color and rejects anything else', async () => {
        const habit = await create({ name: 'Color', habit_color: '#1D4ED8' });
        expect(habit.habit_color).toBe('#1d4ed8');
        const bad = await agent
            .put(`/api/habits/${habit.uid}`)
            .send({ habit_color: 'red; background:url(x)' });
        expect(bad.status).toBe(400);
        const cleared = await agent
            .put(`/api/habits/${habit.uid}`)
            .send({ habit_color: null });
        expect(cleared.body.habit.habit_color).toBeNull();
    });

    it('rejects invalid settings', async () => {
        const res = await agent
            .post('/api/habits')
            .send({ name: 'Bad', habit_reminder_time: '25:00' });
        expect(res.status).toBe(400);
    });

    it('allows several check-ins a day up to the daily goal', async () => {
        const habit = await create({ name: 'Morse', habit_target_count: 3 });
        for (let i = 0; i < 4; i++) {
            await agent.post(`/api/habits/${habit.uid}/complete`).send({});
        }
        const count = await RecurringCompletion.count({
            where: { task_id: habit.id },
        });
        expect(count).toBe(3);

        const res = await agent.get(`/api/habits/${habit.uid}`);
        expect(res.body.habit.habit_progress.met).toBe(true);
        expect(res.body.habit.habit_current_streak).toBe(1);
    });

    it('keeps one check-in per day for a simple daily habit', async () => {
        const habit = await create({ name: 'Floss' });
        await agent.post(`/api/habits/${habit.uid}/complete`).send({});
        await agent.post(`/api/habits/${habit.uid}/complete`).send({});
        expect(
            await RecurringCompletion.count({ where: { task_id: habit.id } })
        ).toBe(1);
    });

    it('records amounts and notes for a measurable habit', async () => {
        const habit = await create({
            name: 'Pages',
            habit_target_value: 20,
            habit_unit: 'pages',
        });
        const missing = await agent
            .post(`/api/habits/${habit.uid}/complete`)
            .send({});
        expect(missing.status).toBe(400);

        await agent
            .post(`/api/habits/${habit.uid}/complete`)
            .send({ value: 12, note: 'Dune' });
        const res = await agent
            .post(`/api/habits/${habit.uid}/complete`)
            .send({ value: 10 });
        expect(res.body.task.habit_progress.progress).toBe(22);
        expect(res.body.task.habit_progress.met).toBe(true);

        const list = await agent.get(`/api/habits/${habit.uid}/completions`);
        const noted = list.body.completions.find((c) => c.note === 'Dune');
        expect(noted.value).toBe(12);

        const edited = await agent
            .patch(`/api/habits/${habit.uid}/completions/${noted.id}`)
            .send({ note: 'Dune, ch. 3' });
        expect(edited.status).toBe(200);
        expect(edited.body.completion.note).toBe('Dune, ch. 3');
    });

    it('skips a day without breaking the streak', async () => {
        const habit = await create({ name: 'Run' });
        const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
        await Task.update(
            { created_at: new Date(Date.now() - 5 * 86400000) },
            { where: { id: habit.id } }
        );
        await agent
            .post(`/api/habits/${habit.uid}/complete`)
            .send({ completed_at: day(2) });
        await agent
            .post(`/api/habits/${habit.uid}/skip`)
            .send({ date: day(1) });
        const res = await agent
            .post(`/api/habits/${habit.uid}/complete`)
            .send({});
        expect(res.body.task.habit_current_streak).toBe(2);
        expect(res.body.task.habit_total_completions).toBe(2);
    });

    it('tracks a quit habit as clean days and slips', async () => {
        const habit = await create({
            name: 'No sugar',
            habit_polarity: 'quit',
        });
        await Task.update(
            { created_at: new Date(Date.now() - 3 * 86400000) },
            { where: { id: habit.id } }
        );
        let res = await agent.get(`/api/habits/${habit.uid}`);
        expect(res.body.habit.habit_current_streak).toBe(4);

        const skip = await agent.post(`/api/habits/${habit.uid}/skip`).send({});
        expect(skip.status).toBe(400);

        res = await agent.post(`/api/habits/${habit.uid}/complete`).send({});
        expect(res.body.task.habit_current_streak).toBe(0);
        expect(res.body.task.habit_progress.met).toBe(false);
    });

    it('archives and restores a habit', async () => {
        const habit = await create({ name: 'Old habit' });
        await agent.post(`/api/habits/${habit.uid}/archive`);

        let list = await agent.get('/api/habits');
        expect(list.body.habits.map((h) => h.uid)).not.toContain(habit.uid);
        list = await agent.get('/api/habits?archived=true');
        expect(list.body.habits[0].habit_archived).toBe(true);

        await agent.post(`/api/habits/${habit.uid}/complete`).send({});
        const row = await Task.findOne({ where: { uid: habit.uid } });
        expect(row.status).toBe(3);

        await agent.post(`/api/habits/${habit.uid}/unarchive`);
        list = await agent.get('/api/habits');
        expect(list.body.habits.map((h) => h.uid)).toContain(habit.uid);
    });

    it("does not expose another user's habit", async () => {
        const other = await createTestUser({ email: 'habits-x@example.com' });
        const foreign = await Task.create({
            name: 'Theirs',
            user_id: other.id,
            habit_mode: true,
        });
        const res = await agent.post(`/api/habits/${foreign.uid}/complete`);
        expect(res.status).toBe(404);
    });

    describe('reminders', () => {
        it('sends one reminder per day while the habit is open', async () => {
            const habit = await create({
                name: 'Stretch',
                habit_reminder_time: '09:00',
            });
            // 09:10 in Athens.
            const now = new Date('2026-09-15T06:10:00Z');
            await Task.update(
                { created_at: new Date('2026-09-01T08:00:00Z') },
                { where: { id: habit.id } }
            );

            await checkHabitReminders(now);
            await checkHabitReminders(new Date('2026-09-15T06:15:00Z'));

            const notes = await Notification.findAll({
                where: { user_id: user.id, type: 'reminder' },
            });
            expect(notes).toHaveLength(1);
            expect(notes[0].data.habitUid).toBe(habit.uid);
        });

        it('stays quiet before the time and once done', async () => {
            const habit = await create({
                name: 'Water',
                habit_reminder_time: '20:00',
            });
            await checkHabitReminders(new Date('2026-09-15T06:10:00Z'));
            await RecurringCompletion.create({
                task_id: habit.id,
                completed_at: new Date('2026-09-15T10:00:00Z'),
                original_due_date: new Date('2026-09-15T10:00:00Z'),
            });
            await checkHabitReminders(new Date('2026-09-15T17:05:00Z'));

            expect(
                await Notification.count({
                    where: { user_id: user.id, type: 'reminder' },
                })
            ).toBe(0);
        });
    });
});
