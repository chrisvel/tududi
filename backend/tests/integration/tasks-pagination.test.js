const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks Pagination', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'pagination-test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'pagination-test@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/tasks with pagination', () => {
        it('should return all tasks when no pagination params provided', async () => {
            // Create 5 tasks
            for (let i = 1; i <= 5; i++) {
                await Task.create({
                    user_id: user.id,
                    name: `Test Task ${i}`,
                    status: 0,
                });
            }

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();
            expect(response.body.tasks.length).toBeGreaterThanOrEqual(5);
            // Should NOT include pagination metadata when no params provided
            expect(response.body.pagination).toBeUndefined();
        });

        it('should paginate tasks with limit and offset', async () => {
            // Create 25 tasks
            for (let i = 1; i <= 25; i++) {
                await Task.create({
                    user_id: user.id,
                    name: `Paginated Task ${i}`,
                    status: 0,
                });
            }

            // First page
            const response1 = await agent.get('/api/tasks').query({
                limit: 10,
                offset: 0,
            });

            expect(response1.status).toBe(200);
            expect(response1.body.tasks).toBeDefined();
            expect(response1.body.pagination).toBeDefined();
            expect(response1.body.pagination.total).toBeGreaterThanOrEqual(25);
            expect(response1.body.pagination.limit).toBe(10);
            expect(response1.body.pagination.offset).toBe(0);
            expect(response1.body.tasks.length).toBe(10);
            expect(response1.body.pagination.hasMore).toBe(true);

            // Second page
            const response2 = await agent.get('/api/tasks').query({
                limit: 10,
                offset: 10,
            });

            expect(response2.status).toBe(200);
            expect(response2.body.pagination.offset).toBe(10);
            expect(response2.body.tasks.length).toBe(10);
            expect(response2.body.pagination.hasMore).toBe(true);

            // Third page
            const response3 = await agent.get('/api/tasks').query({
                limit: 10,
                offset: 20,
            });

            expect(response3.status).toBe(200);
            expect(response3.body.pagination.offset).toBe(20);
            expect(response3.body.tasks.length).toBeGreaterThanOrEqual(5);
        });

        it('should work with other query params', async () => {
            // Create tasks with different priorities
            for (let i = 1; i <= 15; i++) {
                await Task.create({
                    user_id: user.id,
                    name: `Task ${i}`,
                    status: 0,
                    priority: i % 3, // 0, 1, 2
                });
            }

            // Get first page of high priority tasks
            const response = await agent.get('/api/tasks').query({
                priority: 'high',
                limit: 3,
                offset: 0,
            });

            expect(response.status).toBe(200);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.tasks.length).toBeLessThanOrEqual(3);
        });

        it('should handle offset beyond total results', async () => {
            // Create 5 tasks
            for (let i = 1; i <= 5; i++) {
                await Task.create({
                    user_id: user.id,
                    name: `Task ${i}`,
                    status: 0,
                });
            }

            const response = await agent.get('/api/tasks').query({
                limit: 10,
                offset: 100,
            });

            expect(response.status).toBe(200);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.tasks.length).toBe(0);
            expect(response.body.pagination.hasMore).toBe(false);
        });
    });
});
