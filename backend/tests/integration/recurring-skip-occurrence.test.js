const request = require('supertest');
const app = require('../../app');
const { Task, RecurringCompletion, TaskEvent } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/task/:uid/skip-occurrence', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'skip@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'skip@example.com',
            password: 'password123',
        });
    });

    const createMonthlyTask = (attrs = {}) =>
        Task.create({
            name: 'Electricity bill',
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 15,
            due_date: new Date(Date.UTC(2026, 0, 15, 12)),
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
            ...attrs,
        });

    it('moves the task to its next occurrence without completing it', async () => {
        const task = await createMonthlyTask();

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);

        await task.reload();
        expect(task.status).toBe(Task.STATUS.NOT_STARTED);
        expect(task.completed_at).toBeNull();
        const nextDue = new Date(task.due_date);
        expect(nextDue.getUTCMonth()).toBe(1);
        expect(nextDue.getUTCDate()).toBe(15);

        const completions = await RecurringCompletion.findAll({
            where: { task_id: task.id },
        });
        expect(completions).toHaveLength(1);
        expect(completions[0].skipped).toBe(true);
        expect(new Date(completions[0].original_due_date).toISOString()).toBe(
            new Date(Date.UTC(2026, 0, 15, 12)).toISOString()
        );

        const events = await TaskEvent.findAll({
            where: {
                task_id: task.id,
                event_type: 'recurring_occurrence_skipped',
            },
        });
        expect(events).toHaveLength(1);
    });

    it('resets an in-progress task when skipping', async () => {
        const task = await createMonthlyTask({
            status: Task.STATUS.IN_PROGRESS,
        });

        await agent.post(`/api/task/${task.uid}/skip-occurrence`);

        await task.reload();
        expect(task.status).toBe(Task.STATUS.NOT_STARTED);
    });

    it('cancels the task when skipping the last occurrence', async () => {
        const task = await createMonthlyTask({
            recurrence_end_date: new Date(Date.UTC(2026, 0, 31)),
        });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(200);
        await task.reload();
        expect(task.status).toBe(Task.STATUS.CANCELLED);
        expect(task.completed_at).toBeNull();

        const completion = await RecurringCompletion.findOne({
            where: { task_id: task.id },
        });
        expect(completion.skipped).toBe(true);
    });

    it('returns 400 for a task whose series already ended', async () => {
        const task = await createMonthlyTask({
            recurrence_end_date: new Date(Date.UTC(2026, 0, 31)),
            status: Task.STATUS.DONE,
            completed_at: new Date(),
        });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(400);
        await task.reload();
        expect(task.status).toBe(Task.STATUS.DONE);
        expect(task.completed_at).not.toBeNull();
        const completions = await RecurringCompletion.count({
            where: { task_id: task.id },
        });
        expect(completions).toBe(0);
    });

    it('returns 400 for a cancelled task', async () => {
        const task = await createMonthlyTask({
            status: Task.STATUS.CANCELLED,
        });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(400);
        await task.reload();
        expect(task.status).toBe(Task.STATUS.CANCELLED);
        const completions = await RecurringCompletion.count({
            where: { task_id: task.id },
        });
        expect(completions).toBe(0);
    });

    it('returns 400 for a non-recurring task', async () => {
        const task = await Task.create({
            name: 'One-off',
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });

        const response = await agent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect(response.status).toBe(400);
        const completions = await RecurringCompletion.count({
            where: { task_id: task.id },
        });
        expect(completions).toBe(0);
    });

    it('returns 400 for a generated recurring instance', async () => {
        const parent = await createMonthlyTask();
        const instance = await Task.create({
            name: 'Electricity bill',
            recurrence_type: 'monthly',
            recurring_parent_id: parent.id,
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });

        const response = await agent.post(
            `/api/task/${instance.uid}/skip-occurrence`
        );

        expect(response.status).toBe(400);
    });

    it("does not let another user skip someone else's task", async () => {
        const task = await createMonthlyTask();
        await createTestUser({ email: 'other@example.com' });
        const otherAgent = request.agent(app);
        await otherAgent.post('/api/login').send({
            email: 'other@example.com',
            password: 'password123',
        });

        const response = await otherAgent.post(
            `/api/task/${task.uid}/skip-occurrence`
        );

        expect([403, 404]).toContain(response.status);
        await task.reload();
        expect(new Date(task.due_date).getUTCMonth()).toBe(0);
    });
});
