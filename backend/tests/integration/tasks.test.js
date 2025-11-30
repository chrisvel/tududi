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
                .patch(`/api/task/${task.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.id).toBeDefined();
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.note).toBe(updateData.note);
            expect(response.body.priority).toBe(updateData.priority);
            expect(response.body.status).toBe(updateData.status);
        });

        it('should update recurring task name without transformation', async () => {
            // Create a recurring task
            const recurringTask = await Task.create({
                name: 'My Daily Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                status: 0,
            });

            const updateData = {
                name: 'Updated Daily Task Name',
            };

            const response = await agent
                .patch(`/api/task/${recurringTask.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.id).toBeDefined();
            // The response should contain the actual updated name, not a transformed name like "Daily"
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.original_name).toBe(updateData.name);
        });

        it('should return 403 for non-existent task', async () => {
            const response = await agent
                .patch('/api/task/nonexistent-uid-12345')
                .send({ name: 'Updated' });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
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
                .patch(`/api/task/${otherTask.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/task/${task.uid}`)
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
            const response = await agent.delete(`/api/task/${task.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Task successfully deleted');

            // Verify task is deleted
            const deletedTask = await Task.findByPk(task.id);
            expect(deletedTask).toBeNull();
        }, 10000); // 10 second timeout for DELETE operations

        it('should return 403 for non-existent task', async () => {
            const response = await agent.delete(
                '/api/task/nonexistent-uid-12345'
            );

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
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

            const response = await agent.delete(`/api/task/${otherTask.uid}`);

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        }, 10000); // 10 second timeout for this specific test

        it('should require authentication', async () => {
            const response = await request(app).delete(`/api/task/${task.uid}`);

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

        it('should return all tags when filtering by a specific tag', async () => {
            const taskData = {
                name: 'Task with multiple tags',
                tags: [{ name: 'alpha' }, { name: 'beta' }],
            };

            const createResponse = await agent.post('/api/task').send(taskData);
            expect(createResponse.status).toBe(201);

            const response = await agent.get('/api/tasks?tag=alpha');

            expect(response.status).toBe(200);
            expect(response.body.tasks.length).toBe(1);

            const [task] = response.body.tasks;
            const tagNames = (task.tags || []).map((t) => t.name);

            expect(tagNames).toEqual(expect.arrayContaining(['alpha', 'beta']));
            expect(tagNames.length).toBe(2);
        });
    });

    describe('Subtasks filtering', () => {
        it('should not include subtasks at first level when retrieving /tasks', async () => {
            // Create a parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: user.id,
                status: 0,
            });

            // Create subtasks
            const subtask1 = await Task.create({
                name: 'Subtask 1',
                user_id: user.id,
                parent_task_id: parentTask.id,
                status: 0,
            });

            const subtask2 = await Task.create({
                name: 'Subtask 2',
                user_id: user.id,
                parent_task_id: parentTask.id,
                status: 0,
            });

            // Create another regular task (not a subtask)
            const regularTask = await Task.create({
                name: 'Regular Task',
                user_id: user.id,
                status: 0,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            // Should only return parent and regular tasks, not subtasks
            const taskIds = response.body.tasks.map((t) => t.id);
            const taskNames = response.body.tasks.map((t) => t.name);

            expect(taskIds).toContain(parentTask.id);
            expect(taskIds).toContain(regularTask.id);
            expect(taskIds).not.toContain(subtask1.id);
            expect(taskIds).not.toContain(subtask2.id);

            expect(taskNames).toContain('Parent Task');
            expect(taskNames).toContain('Regular Task');
            expect(taskNames).not.toContain('Subtask 1');
            expect(taskNames).not.toContain('Subtask 2');
        });
    });

    describe('Recurring task search functionality', () => {
        it('should include recurring task instances in search results', async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Create a recurring task template (set for today to ensure it's included)
            const recurringTemplate = await Task.create({
                name: 'RecurringTask',
                user_id: user.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                status: 0,
            });

            // Create a recurring task instance (simulating what the recurring task service would create)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const recurringInstance = await Task.create({
                name: 'RecurringTask',
                user_id: user.id,
                recurring_parent_id: recurringTemplate.id,
                due_date: tomorrow,
                status: 0,
            });

            // Create a regular non-recurring task for comparison
            const regularTask = await Task.create({
                name: 'Review Pull Request',
                user_id: user.id,
                status: 0,
            });

            const response = await agent.get(
                '/api/tasks?include_instances=true'
            );

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            const taskIds = response.body.tasks.map((t) => t.id);
            const taskNames = response.body.tasks.map((t) => t.name);

            // Should include the recurring template
            expect(taskIds).toContain(recurringTemplate.id);

            // Should include the recurring instance (this is the key fix - instances should be searchable)
            expect(taskIds).toContain(recurringInstance.id);

            // Should include the regular task
            expect(taskIds).toContain(regularTask.id);
            expect(taskNames).toContain('Review Pull Request');

            // Verify we have both the template and instance - this proves search will work on both
            const allTasks = response.body.tasks;
            const templateTask = allTasks.find(
                (t) => t.id === recurringTemplate.id
            );
            const instanceTask = allTasks.find(
                (t) => t.id === recurringInstance.id
            );

            expect(templateTask).toBeDefined();
            // The template name gets transformed to show the recurrence type in the API response
            expect(templateTask.name).toBe('Daily');
            expect(templateTask.recurrence_type).toBe('daily');
            expect(templateTask.recurring_parent_id).toBeNull();
            // The original name is preserved in original_name field
            expect(templateTask.original_name).toBe('RecurringTask');

            expect(instanceTask).toBeDefined();
            // Instances keep their original name
            expect(instanceTask.name).toBe('RecurringTask');
            expect(instanceTask.recurring_parent_id).toBe(recurringTemplate.id);
        });

        it('should not include past recurring instances', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            // Create a recurring task template
            const recurringTemplate = await Task.create({
                name: 'Daily Review',
                user_id: user.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: yesterday, // Template is in the past but should still be included if it's recurring
                status: 0,
            });

            // Create a past recurring task instance
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            const pastInstance = await Task.create({
                name: 'Daily Review',
                user_id: user.id,
                recurring_parent_id: recurringTemplate.id,
                due_date: twoDaysAgo,
                status: 0,
            });

            // Create a future recurring task instance
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const futureInstance = await Task.create({
                name: 'Daily Review',
                user_id: user.id,
                recurring_parent_id: recurringTemplate.id,
                due_date: tomorrow,
                status: 0,
            });

            const response = await agent.get(
                '/api/tasks?include_instances=true'
            );

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            const taskIds = response.body.tasks.map((t) => t.id);

            // Should not include past instances
            expect(taskIds).not.toContain(pastInstance.id);

            // Should include future instances
            expect(taskIds).toContain(futureInstance.id);

            // Template should not be included because it's in the past
            expect(taskIds).not.toContain(recurringTemplate.id);
        });
    });
});
