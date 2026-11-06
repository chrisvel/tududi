const request = require('supertest');
const app = require('../../app');
const { Task, RecurringCompletion, Permission } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('GET /api/task/:uid/recurring-history', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'history@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'history@example.com',
            password: 'password123',
        });
    });

    const createRecurring = () =>
        Task.create({
            user_id: user.id,
            name: 'Water the plants',
            status: 0,
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            due_date: new Date('2030-03-29T12:00:00Z'),
        });

    const addOccurrence = (task, scheduled, done, skipped = false) =>
        RecurringCompletion.create({
            task_id: task.id,
            original_due_date: new Date(scheduled),
            completed_at: new Date(done),
            skipped,
        });

    it('lists occurrences newest first, keeping scheduled and completed dates apart', async () => {
        const task = await createRecurring();
        await addOccurrence(
            task,
            '2030-03-01T12:00:00Z',
            '2030-03-04T12:00:00Z'
        );
        await addOccurrence(
            task,
            '2030-03-08T12:00:00Z',
            '2030-03-08T13:00:00Z',
            true
        );

        const response = await agent.get(
            `/api/task/${task.uid}/recurring-history`
        );

        expect(response.status).toBe(200);
        expect(response.body.total).toBe(2);
        expect(response.body.completed_count).toBe(1);
        expect(response.body.skipped_count).toBe(1);
        expect(response.body.has_more).toBe(false);
        expect(response.body.occurrences).toEqual([
            expect.objectContaining({
                scheduled_for: '2030-03-08',
                skipped: true,
            }),
            expect.objectContaining({
                scheduled_for: '2030-03-01',
                completed_date: '2030-03-04',
                completed_at: '2030-03-04T12:00:00.000Z',
                skipped: false,
            }),
        ]);
    });

    it('reads dates in the timezone of the user', async () => {
        await user.update({ timezone: 'Pacific/Auckland' });
        const task = await createRecurring();
        await addOccurrence(
            task,
            '2030-03-01T20:00:00Z',
            '2030-03-02T20:00:00Z'
        );

        const response = await agent.get(
            `/api/task/${task.uid}/recurring-history`
        );

        expect(response.body.occurrences[0].scheduled_for).toBe('2030-03-02');
        expect(response.body.occurrences[0].completed_date).toBe('2030-03-03');
    });

    it('pages through the history without repeating a row', async () => {
        const task = await createRecurring();
        for (let day = 10; day < 22; day += 1) {
            await addOccurrence(
                task,
                `2030-03-${day}T12:00:00Z`,
                `2030-03-${day}T12:00:00Z`
            );
        }

        const first = await agent.get(
            `/api/task/${task.uid}/recurring-history`
        );
        const second = await agent.get(
            `/api/task/${task.uid}/recurring-history?offset=10`
        );

        expect(first.body.occurrences).toHaveLength(10);
        expect(first.body.has_more).toBe(true);
        expect(second.body.occurrences).toHaveLength(2);
        expect(second.body.has_more).toBe(false);
        const ids = [...first.body.occurrences, ...second.body.occurrences].map(
            (occurrence) => occurrence.id
        );
        expect(new Set(ids).size).toBe(12);
    });

    it('keeps the limit in bounds and ignores a bad one', async () => {
        const task = await createRecurring();
        for (let day = 10; day < 22; day += 1) {
            await addOccurrence(
                task,
                `2030-03-${day}T12:00:00Z`,
                `2030-03-${day}T12:00:00Z`
            );
        }

        const small = await agent.get(
            `/api/task/${task.uid}/recurring-history?limit=3`
        );
        const bad = await agent.get(
            `/api/task/${task.uid}/recurring-history?limit=-5&offset=nope`
        );

        expect(small.body.occurrences).toHaveLength(3);
        expect(bad.body.occurrences).toHaveLength(10);
    });

    it('keeps past occurrences unchanged after the rule is edited', async () => {
        const task = await createRecurring();
        await agent.post(`/api/task/${task.uid}/skip-occurrence`);
        const before = await agent.get(
            `/api/task/${task.uid}/recurring-history`
        );

        await agent.patch(`/api/task/${task.uid}`).send({
            recurrence_type: 'monthly',
            recurrence_month_day: 15,
        });
        const after = await agent.get(
            `/api/task/${task.uid}/recurring-history`
        );

        expect(before.body.occurrences).toHaveLength(1);
        expect(before.body.occurrences[0].skipped).toBe(true);
        expect(before.body.occurrences[0].scheduled_for).toBe('2030-03-29');
        expect(after.body.occurrences).toEqual(before.body.occurrences);
    });

    it('returns an empty history for a task with no occurrences', async () => {
        const task = await createRecurring();

        const response = await agent.get(
            `/api/task/${task.uid}/recurring-history`
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            occurrences: [],
            total: 0,
            has_more: false,
        });
    });

    describe('access', () => {
        let otherAgent, other;

        beforeEach(async () => {
            other = await createTestUser({ email: 'other@example.com' });
            otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: 'other@example.com',
                password: 'password123',
            });
        });

        it('hides the history from another user', async () => {
            const task = await createRecurring();
            await addOccurrence(
                task,
                '2030-03-01T12:00:00Z',
                '2030-03-01T12:00:00Z'
            );

            const response = await otherAgent.get(
                `/api/task/${task.uid}/recurring-history`
            );

            expect([403, 404]).toContain(response.status);
            expect(response.body.occurrences).toBeUndefined();
        });

        it('shows it to someone the task is shared with read-only', async () => {
            const task = await createRecurring();
            await addOccurrence(
                task,
                '2030-03-01T12:00:00Z',
                '2030-03-01T12:00:00Z'
            );
            await Permission.create({
                user_id: other.id,
                resource_type: 'task',
                resource_uid: task.uid,
                access_level: 'ro',
                granted_by_user_id: user.id,
            });

            const response = await otherAgent.get(
                `/api/task/${task.uid}/recurring-history`
            );

            expect(response.status).toBe(200);
            expect(response.body.total).toBe(1);
        });
    });
});
