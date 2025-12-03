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
        // Simulate testing on December 3rd
        const mockDate = new Date('2025-12-03T10:00:00Z');

        // Create a monthly recurring task with day 30 (which is in the future for December)
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

        // Calculate next iterations starting from Dec 3
        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        // First occurrence should be December 30, 2025, not January 30, 2026
        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2025);
        expect(firstIteration.getUTCMonth()).toBe(11); // December (0-indexed)
        expect(firstIteration.getUTCDate()).toBe(30);
    });

    it('should set first occurrence in next month when day has already passed', async () => {
        // Simulate testing on December 31st
        const mockDate = new Date('2025-12-31T10:00:00Z');

        const task = {
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 15,
        };

        // Calculate next iterations starting from Dec 31
        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        // First occurrence should be January 15, 2026 (since Dec 15 has passed)
        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2026);
        expect(firstIteration.getUTCMonth()).toBe(0); // January (0-indexed)
        expect(firstIteration.getUTCDate()).toBe(15);
    });

    it('should handle months with fewer days correctly', async () => {
        // Simulate testing on February 15, 2025
        const mockDate = new Date('2025-02-15T10:00:00Z');

        const task = {
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 31, // February only has 28 days in 2025
        };

        // Calculate next iterations starting from Feb 15
        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        // First occurrence should be March 31, 2025 (skipping February since it doesn't have 31 days)
        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2025);
        expect(firstIteration.getUTCMonth()).toBe(2); // March (0-indexed)
        expect(firstIteration.getUTCDate()).toBe(31);
    });

    it('should include current month when target day is valid and in the future', async () => {
        // Simulate testing on December 3rd
        const mockDate = new Date('2025-12-03T10:00:00Z');

        const task = {
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 25,
        };

        // Calculate next iterations starting from Dec 3
        const iterations = await calculateNextIterations(
            task,
            mockDate,
            'America/New_York'
        );

        // First occurrence should be December 25, 2025
        expect(iterations.length).toBeGreaterThan(0);

        const firstIteration = new Date(iterations[0].utc_date);
        expect(firstIteration.getUTCFullYear()).toBe(2025);
        expect(firstIteration.getUTCMonth()).toBe(11); // December (0-indexed)
        expect(firstIteration.getUTCDate()).toBe(25);

        // Second occurrence should be January 25, 2026
        const secondIteration = new Date(iterations[1].utc_date);
        expect(secondIteration.getUTCFullYear()).toBe(2026);
        expect(secondIteration.getUTCMonth()).toBe(0); // January (0-indexed)
        expect(secondIteration.getUTCDate()).toBe(25);
    });

    it('should work with full API integration', async () => {
        // Create a monthly recurring task with day 20
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

        // Verify the task was saved with correct recurrence settings
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

        // Directly test calculateNextIterations with the task
        const iterations = await calculateNextIterations(
            task,
            new Date(),
            'America/New_York'
        );

        expect(iterations.length).toBeGreaterThan(0);

        // The first iteration should be in the current or next month depending on today's date
        const today = new Date();
        const firstIteration = new Date(iterations[0].utc_date);

        if (today.getUTCDate() < 20) {
            // If today is before the 20th, first occurrence should be this month
            expect(firstIteration.getUTCMonth()).toBe(today.getUTCMonth());
            expect(firstIteration.getUTCDate()).toBe(20);
        } else {
            // If today is on or after the 20th, first occurrence should be next month
            const nextMonth = new Date(today);
            nextMonth.setUTCMonth(today.getUTCMonth() + 1);
            expect(firstIteration.getUTCMonth()).toBe(nextMonth.getUTCMonth());
            expect(firstIteration.getUTCDate()).toBe(20);
        }
    });
});
