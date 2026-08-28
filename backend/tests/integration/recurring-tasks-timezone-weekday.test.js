const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Recurring Tasks - Weekday Recurrence Across Timezones (issue #1415)', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'tokyo-user@example.com',
            timezone: 'Asia/Tokyo',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    it('never expands a Mon-Fri recurring task onto a Saturday/Sunday for a UTC+9 user', async () => {
        const taskData = {
            name: 'Weekday Standup',
            recurrence_type: 'weekly',
            recurrence_weekdays: [1, 2, 3, 4, 5],
        };

        const createResponse = await agent.post('/api/task').send(taskData);
        expect(createResponse.status).toBe(201);

        const listResponse = await agent.get(
            '/api/tasks?type=upcoming&groupBy=day&maxDays=21'
        );
        expect(listResponse.status).toBe(200);

        const occurrences = listResponse.body.tasks.filter(
            (t) => t.original_name === 'Weekday Standup'
        );
        expect(occurrences.length).toBeGreaterThan(0);

        occurrences.forEach((occurrence) => {
            const localWeekday = moment
                .tz(occurrence.due_date, 'Asia/Tokyo')
                .day();
            expect(localWeekday).toBeGreaterThanOrEqual(1);
            expect(localWeekday).toBeLessThanOrEqual(5);
        });
    });

    it('advances a "Repeat on Monday" task to the correct weekday, not one day late', async () => {
        const taskData = {
            name: 'Every Monday Review',
            recurrence_type: 'weekly',
            recurrence_weekday: 1,
        };

        const createResponse = await agent.post('/api/task').send(taskData);
        expect(createResponse.status).toBe(201);

        const iterationsResponse = await agent.get(
            `/api/task/${createResponse.body.uid}/next-iterations`
        );
        expect(iterationsResponse.status).toBe(200);

        iterationsResponse.body.iterations.forEach((iteration) => {
            expect(moment.tz(iteration.date, 'Asia/Tokyo').day()).toBe(1);
        });
    });
});
