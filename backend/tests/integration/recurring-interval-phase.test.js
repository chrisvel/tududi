const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Recurring task iterations keep the due date phase (issue #1489)', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'phase-test@example.com',
            timezone: 'UTC',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    it('keeps a "repeat daily every 14 days" task anchored to its due date', async () => {
        const createResponse = await agent.post('/api/task').send({
            name: 'Every 14 days',
            due_date: '2026-09-18',
            recurrence_type: 'daily',
            recurrence_interval: 14,
        });
        expect(createResponse.status).toBe(201);

        const iterationsResponse = await agent.get(
            `/api/task/${createResponse.body.uid}/next-iterations?startFromDate=2026-09-18`
        );
        expect(iterationsResponse.status).toBe(200);

        const dates = iterationsResponse.body.iterations.map((i) => i.date);
        expect(dates).toEqual([
            '2026-09-18',
            '2026-10-02',
            '2026-10-16',
            '2026-10-30',
            '2026-11-13',
            '2026-11-27',
        ]);
    });

    it('keeps a "repeat weekly every 2 weeks" task anchored to its due date', async () => {
        const createResponse = await agent.post('/api/task').send({
            name: 'Every other Friday',
            due_date: '2026-09-18', // a Friday
            recurrence_type: 'weekly',
            recurrence_interval: 2,
            recurrence_weekday: 5,
        });
        expect(createResponse.status).toBe(201);

        const iterationsResponse = await agent.get(
            `/api/task/${createResponse.body.uid}/next-iterations?startFromDate=2026-09-18`
        );
        expect(iterationsResponse.status).toBe(200);

        const dates = iterationsResponse.body.iterations.map((i) => i.date);
        expect(dates).toEqual([
            '2026-09-18',
            '2026-10-02',
            '2026-10-16',
            '2026-10-30',
            '2026-11-13',
            '2026-11-27',
        ]);
    });
});
