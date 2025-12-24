const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    calculateNextIterations,
} = require('../../routes/tasks/operations/recurring');

describe('Monthly Recurrence - Current Month Bug Fix', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test-monthly@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test-monthly@example.com',
            password: 'password123',
        });
    });

    it('should set first occurrence in current month when day is in the future', async () => {
        const mockDate = new Date('2025-12-03T10:00:00Z');

        const taskData = {
            name: 'Monthly Report',
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 30,
            priority: 1,
        };

        const task = {
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 30,
        };

        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2025);
        expect(firstIteration.getUTCMonth()).toBe(11);
        expect(firstIteration.getUTCDate()).toBe(30);
    });

    it('should set first occurrence in next month when day has already passed', async () => {
        const mockDate = new Date('2025-12-31T10:00:00Z');

        const task = {
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 15,
        };

        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2026);
        expect(firstIteration.getUTCMonth()).toBe(0);
        expect(firstIteration.getUTCDate()).toBe(15);
    });

    it('should handle months with fewer days correctly', async () => {
        const mockDate = new Date('2025-02-15T10:00:00Z');

        const task = {
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 31,
        };

        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2025);
        expect(firstIteration.getUTCMonth()).toBe(2);
        expect(firstIteration.getUTCDate()).toBe(31);
    });

    it('should include current month when target day is valid and in the future', async () => {
        const mockDate = new Date('2025-12-03T10:00:00Z');

        const task = {
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 25,
        };

        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2025);
        expect(firstIteration.getUTCMonth()).toBe(11);
        expect(firstIteration.getUTCDate()).toBe(25);

        const secondIteration = new Date(iterations[1].utc_date);
        expect(secondIteration.getUTCFullYear()).toBe(2026);
        expect(secondIteration.getUTCMonth()).toBe(0);
        expect(secondIteration.getUTCDate()).toBe(25);
    });

    it('should work with full API integration', async () => {
        const taskData = {
            name: 'Monthly Task on 20th',
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 20,
            priority: 1,
        };

        const createResponse = await agent.post('/api/task').send(taskData);

        expect(createResponse.status).toBe(201);
        expect(createResponse.body.recurrence_type).toBe('monthly');
        expect(createResponse.body.recurrence_month_day).toBe(20);

        const task = await Task.findOne({
            where: {
                name: taskData.name,
                user_id: user.id,
            },
        });

        expect(task).not.toBeNull();
        expect(task.recurrence_type).toBe('monthly');
        expect(task.recurrence_month_day).toBe(20);
        expect(task.recurrence_interval).toBe(1);

        // Use a fixed date to make test deterministic (Dec 10, before the 20th)
        const mockDate = new Date('2025-12-10T10:00:00Z');

        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        // Since mockDate is Dec 10 and target is 20th, first iteration should be Dec 20
        expect(firstIteration.getUTCFullYear()).toBe(2025);
        expect(firstIteration.getUTCMonth()).toBe(11); // December
        expect(firstIteration.getUTCDate()).toBe(20);
    });
});
