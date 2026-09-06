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

describe('GET /api/tasks database pagination', () => {
    const request = require('supertest');
    const app = require('../../app');
    const { Task, Tag } = require('../../models');
    const { createTestUser } = require('../helpers/testUtils');

    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `dbpage_${Date.now()}@example.com`,
        });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it('pages a filtered list without loading every row', async () => {
        const tag = await Tag.create({ name: 'paged', user_id: user.id });
        for (let i = 1; i <= 12; i++) {
            const task = await Task.create({
                user_id: user.id,
                name: `Tagged ${String(i).padStart(2, '0')}`,
                status: 0,
            });
            if (i % 2 === 0) await task.setTags([tag.id]);
        }
        const spy = jest.spyOn(Task, 'findAll');

        const page1 = await agent
            .get('/api/tasks')
            .query({ tag: 'paged', limit: 4, offset: 0, order_by: 'name:asc' });
        expect(page1.status).toBe(200);
        expect(page1.body.tasks).toHaveLength(4);
        expect(page1.body.pagination).toEqual({
            total: 6,
            limit: 4,
            offset: 0,
            hasMore: true,
        });
        expect(page1.body.tasks.every((t) => t.name.startsWith('Tagged'))).toBe(
            true
        );

        const page2 = await agent
            .get('/api/tasks')
            .query({ tag: 'paged', limit: 4, offset: 4, order_by: 'name:asc' });
        expect(page2.body.tasks).toHaveLength(2);
        expect(page2.body.pagination.hasMore).toBe(false);

        // The main list query was not a full findAll for the paged calls
        expect(spy).not.toHaveBeenCalledWith(
            expect.objectContaining({ distinct: true, limit: undefined })
        );
        spy.mockRestore();

        const names = [...page1.body.tasks, ...page2.body.tasks].map(
            (t) => t.name
        );
        expect(new Set(names).size).toBe(6);
    });

    it('still pages today and upcoming-by-day in memory', async () => {
        for (let i = 1; i <= 5; i++) {
            await Task.create({
                user_id: user.id,
                name: `Due ${i}`,
                status: 0,
                due_date: new Date(),
            });
        }
        const today = await agent
            .get('/api/tasks')
            .query({ type: 'today', limit: 2, offset: 0 });
        expect(today.status).toBe(200);
        expect(today.body.pagination).toMatchObject({ limit: 2, offset: 0 });
        expect(typeof today.body.pagination.total).toBe('number');
        expect(today.body.tasks.length).toBeLessThanOrEqual(2);
    });
});
