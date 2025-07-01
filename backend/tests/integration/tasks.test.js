const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/task', () => {
        it('should create a new task', async () => {
            const taskData = {
                name: 'Test Task',
                note: 'Test Note',
                priority: 1,
                status: 0,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.name).toBe(taskData.name);
            expect(response.body.note).toBe(taskData.note);
            expect(response.body.priority).toBe(taskData.priority);
            expect(response.body.status).toBe(taskData.status);
            expect(response.body.user_id).toBe(user.id);
        });

        it('should require authentication', async () => {
            const taskData = {
                name: 'Test Task',
            };

            const response = await request(app)
                .post('/api/task')
                .send(taskData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require task name', async () => {
            // Mock console.error to suppress expected error log in test output
            const originalConsoleError = console.error;
            console.error = jest.fn();

            const taskData = {
                description: 'Test Description',
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(400);

            // Restore original console.error
            console.error = originalConsoleError;
        });
    });

    describe('GET /api/tasks', () => {
        let task1, task2;

        beforeEach(async () => {
            task1 = await Task.create({
                name: 'Task 1',
                description: 'Description 1',
                user_id: user.id,
                today: true,
            });

            task2 = await Task.create({
                name: 'Task 2',
                description: 'Description 2',
                user_id: user.id,
                today: false,
            });
        });

        it('should get all user tasks', async () => {
            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();
            expect(response.body.tasks.length).toBe(2);
            expect(response.body.tasks.map((t) => t.id)).toContain(task1.id);
            expect(response.body.tasks.map((t) => t.id)).toContain(task2.id);
        });

        it('should filter today tasks (returns all user tasks)', async () => {
            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();
            expect(response.body.tasks.length).toBe(2);
            // Both tasks should be returned as "today" doesn't filter by the today field
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/tasks');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    // Note: No individual task GET route exists in the current API

    describe('PATCH /api/task/:id', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Test Task',
                description: 'Test Description',
                priority: 0,
                status: 0,
                user_id: user.id,
            });
        });

        it('should update task', async () => {
            const updateData = {
                name: 'Updated Task',
                note: 'Updated Note',
                priority: 2,
                status: 1,
            };

            const response = await agent
                .patch(`/api/task/${task.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.id).toBeDefined();
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.note).toBe(updateData.note);
            expect(response.body.priority).toBe(updateData.priority);
            expect(response.body.status).toBe(updateData.status);
        });

        it('should return 404 for non-existent task', async () => {
            const response = await agent
                .patch('/api/task/999999')
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Task not found.');
        });

        it("should not allow updating other user's tasks", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherTask = await Task.create({
                name: 'Other Task',
                user_id: otherUser.id,
            });

            const response = await agent
                .patch(`/api/task/${otherTask.id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Task not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/task/${task.id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/task/:id', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
            });
        });

        it('should delete task', async () => {
            const response = await agent.delete(`/api/task/${task.id}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Task successfully deleted');

            // Verify task is deleted
            const deletedTask = await Task.findByPk(task.id);
            expect(deletedTask).toBeNull();
        });

        it('should return 404 for non-existent task', async () => {
            const response = await agent.delete('/api/task/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Task not found.');
        });

        it("should not allow deleting other user's tasks", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherTask = await Task.create({
                name: 'Other Task',
                user_id: otherUser.id,
            });

            const response = await agent.delete(`/api/task/${otherTask.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Task not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(`/api/task/${task.id}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('Task with tags', () => {
        it('should create task with tags', async () => {
            const taskData = {
                name: 'Test Task',
                tags: [{ name: 'work' }, { name: 'urgent' }],
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.Tags).toBeDefined();
            expect(response.body.Tags.length).toBe(2);
            expect(response.body.Tags.map((t) => t.name)).toContain('work');
            expect(response.body.Tags.map((t) => t.name)).toContain('urgent');
        });
    });
});
