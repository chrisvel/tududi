const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task User Isolation', () => {
    let agentA;
    let agentB;
    let userA;
    let userB;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        // Create User A and authenticate
        userA = await createTestUser({
            email: 'usera@test.com',
        });

        agentA = request.agent(app);
        await agentA.post('/api/login').send({
            email: 'usera@test.com',
            password: 'password123',
        });

        // Create User B and authenticate
        userB = await createTestUser({
            email: 'userb@test.com',
        });

        agentB = request.agent(app);
        await agentB.post('/api/login').send({
            email: 'userb@test.com',
            password: 'password123',
        });
    });

    describe('Task creation and visibility', () => {
        it('should NOT allow User B to see User A tasks without a project', async () => {
            // User A creates a task without a project
            const taskResponse = await agentA
                .post('/api/task')
                .send({
                    name: 'User A Private Task',
                    status: 'not_started',
                });

            expect(taskResponse.status).toBe(201);
            const taskA = taskResponse.body;

            // User B tries to fetch all tasks
            const tasksResponse = await agentB.get('/api/tasks');

            expect(tasksResponse.status).toBe(200);
            const tasks = tasksResponse.body.tasks;

            // User B should NOT see User A's task
            const userATask = tasks.find((t) => t.uid === taskA.uid);
            expect(userATask).toBeUndefined();
        });

        it('should NOT allow User B to see User A tasks created via inbox', async () => {
            // User A creates an inbox item
            const inboxResponse = await agentA
                .post('/api/inbox')
                .send({
                    content: 'User A Inbox Item',
                });

            expect(inboxResponse.status).toBe(201);

            // User B tries to fetch inbox items
            const inboxListResponse = await agentB.get('/api/inbox');

            expect(inboxListResponse.status).toBe(200);
            const inboxItems = inboxListResponse.body.items || inboxListResponse.body;

            // User B should NOT see User A's inbox item
            const userAInboxItem = Array.isArray(inboxItems)
                ? inboxItems.find((i) => i.content === 'User A Inbox Item')
                : undefined;
            expect(userAInboxItem).toBeUndefined();
        });

        it('should NOT allow User B to access User A task by UID', async () => {
            // User A creates a task
            const taskResponse = await agentA
                .post('/api/task')
                .send({
                    name: 'User A Secret Task',
                    status: 'not_started',
                });

            expect(taskResponse.status).toBe(201);
            const taskA = taskResponse.body;

            // User B tries to access the task by UID
            const getTaskResponse = await agentB.get(`/api/task/${taskA.uid}`);

            // Should return 403 Forbidden or 404 Not Found
            expect([403, 404]).toContain(getTaskResponse.status);
        });

        it('should allow User A to see their own tasks', async () => {
            // User A creates a task
            const taskResponse = await agentA
                .post('/api/task')
                .send({
                    name: 'User A Own Task',
                    status: 'not_started',
                });

            expect(taskResponse.status).toBe(201);
            const taskA = taskResponse.body;

            // User A fetches all tasks
            const tasksResponse = await agentA.get('/api/tasks');

            expect(tasksResponse.status).toBe(200);
            const tasks = tasksResponse.body.tasks;

            // User A should see their own task
            const ownTask = tasks.find((t) => t.uid === taskA.uid);
            expect(ownTask).toBeDefined();
            expect(ownTask.name).toBe('User A Own Task');
        });

        it('should NOT allow User B to see User A tasks in search', async () => {
            // User A creates a unique task
            const taskResponse = await agentA
                .post('/api/task')
                .send({
                    name: 'UniqueTaskNameXYZ123',
                    status: 'not_started',
                });

            expect(taskResponse.status).toBe(201);

            // User B searches for the task
            const searchResponse = await agentB.get('/api/search?q=UniqueTaskNameXYZ123');

            expect(searchResponse.status).toBe(200);
            const results = searchResponse.body.results;

            // User B should NOT see User A's task in search results
            const foundTask = results.find((r) => r.name === 'UniqueTaskNameXYZ123');
            expect(foundTask).toBeUndefined();
        });

        it('should NOT allow User B to see User A tasks in today view', async () => {
            // User A creates a task with today's date
            const today = new Date().toISOString().split('T')[0];
            const taskResponse = await agentA
                .post('/api/task')
                .send({
                    name: 'User A Today Task',
                    status: 'planned',
                    due_date: today,
                });

            expect(taskResponse.status).toBe(201);
            const taskA = taskResponse.body;

            // User B fetches today tasks
            const todayResponse = await agentB.get('/api/tasks?type=today');

            expect(todayResponse.status).toBe(200);
            const tasks = todayResponse.body.tasks;

            // User B should NOT see User A's task
            const userATask = tasks.find((t) => t.uid === taskA.uid);
            expect(userATask).toBeUndefined();
        });
    });
});
