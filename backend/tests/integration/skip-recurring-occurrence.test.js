const request = require('supertest');
const app = require('../../app');
const { Task, RecurringCompletion, TaskEvent } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/task/:uid/skip-occurrence', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'skip@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'skip@example.com',
            password: 'password123',
        });
    });

    const createRecurring = (overrides = {}) =>
        Task.create({
            user_id: user.id,
            name: 'Pay the electricity bill',
            status: 0,
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 15,
            due_date: new Date('2030-03-15T00:00:00Z'),
            ...overrides,
        });

    it('advances the due date and records a skipped occurrence', async () => {
        const task = await createRecurring();

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(0);

        await task.reload();
        expect(task.due_date.toISOString().slice(0, 10)).toBe('2030-04-15');
        expect(task.completed_at).toBeNull();

        const completions = await RecurringCompletion.findAll({
            where: { task_id: task.id },
        });
        expect(completions).toHaveLength(1);
        expect(completions[0].skipped).toBe(true);
        expect(
            completions[0].original_due_date.toISOString().slice(0, 10)
        ).toBe('2030-03-15');

        const events = await TaskEvent.findAll({
            where: {
                task_id: task.id,
                event_type: 'recurring_occurrence_skipped',
            },
        });
        expect(events).toHaveLength(1);
    });

    it('does not count the skip as a completion in metrics', async () => {
        const skipped = await createRecurring({
            name: 'Skipped today',
            recurrence_type: 'daily',
            due_date: new Date(),
        });
        const completed = await createRecurring({
            name: 'Completed today',
            recurrence_type: 'daily',
            due_date: new Date(),
        });

        await agent.post(`/api/task/${skipped.uid}/skip-occurrence`);
        await agent.patch(`/api/task/${completed.uid}`).send({ status: 2 });

        const metrics = await agent.get('/api/tasks/metrics');
        expect(metrics.status).toBe(200);
        const completedIds = metrics.body.tasks_completed_today.map(
            (t) => t.id
        );
        expect(completedIds).toContain(completed.id);
        expect(completedIds).not.toContain(skipped.id);
    });

    it('rejects a task that does not recur', async () => {
        const task = await Task.create({
            user_id: user.id,
            name: 'One-off',
            status: 0,
        });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(400);
        expect(await RecurringCompletion.count()).toBe(0);
    });

    it('rejects a completed task', async () => {
        const task = await createRecurring({ status: 2 });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(400);
    });

    it('rejects a skip past the recurrence end date', async () => {
        const task = await createRecurring({
            recurrence_end_date: new Date('2030-04-01T00:00:00Z'),
        });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(400);
        await task.reload();
        expect(task.due_date.toISOString().slice(0, 10)).toBe('2030-03-15');
    });

    it("refuses another user's task", async () => {
        const other = await createTestUser({ email: 'other@example.com' });
        const task = await createRecurring({ user_id: other.id });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect([403, 404]).toContain(response.status);
        await task.reload();
        expect(task.due_date.toISOString().slice(0, 10)).toBe('2030-03-15');
    });
});
