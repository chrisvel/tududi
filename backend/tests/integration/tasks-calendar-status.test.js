const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Regression tests for #2067: cancelled and archived tasks stayed on the
// Calendar because type=calendar only left out done tasks.
describe('GET /api/tasks?type=calendar status filtering', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `calendar_${Date.now()}@example.com`,
        });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });

        const dueDate = new Date('2026-11-10T00:00:00Z');
        const deferUntil = new Date('2026-11-08T09:00:00Z');
        const make = (name, status, extra = {}) =>
            Task.create({
                name,
                user_id: user.id,
                status,
                due_date: dueDate,
                ...extra,
            });

        await make('Open task', Task.STATUS.NOT_STARTED);
        await make('Waiting task', Task.STATUS.WAITING);
        await make('Done task', Task.STATUS.DONE, { completed_at: new Date() });
        await make('Cancelled task', Task.STATUS.CANCELLED);
        await make('Archived task', Task.STATUS.ARCHIVED);
        await make('Cancelled deferred task', Task.STATUS.CANCELLED, {
            due_date: null,
            defer_until: deferUntil,
        });
    });

    const names = (res) => res.body.tasks.map((task) => task.name).sort();

    it('leaves out done, cancelled and archived tasks by default', async () => {
        const res = await agent.get('/api/tasks?type=calendar');

        expect(res.status).toBe(200);
        expect(names(res)).toEqual(['Open task', 'Waiting task']);
    });

    it('gives the same result with status=active', async () => {
        const res = await agent.get('/api/tasks?type=calendar&status=active');

        expect(res.status).toBe(200);
        expect(names(res)).toEqual(['Open task', 'Waiting task']);
    });

    it('still returns every status when status=all is asked for', async () => {
        const res = await agent.get('/api/tasks?type=calendar&status=all');

        expect(res.status).toBe(200);
        expect(names(res)).toHaveLength(6);
    });
});
