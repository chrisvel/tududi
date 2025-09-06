const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Recurring Tasks API', () => {
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

    describe('POST /api/task - Creating recurring tasks', () => {
        it('should create a daily recurring task', async () => {
            const taskData = {
                name: 'Daily Exercise',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                priority: 1,
                completion_based: false,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Daily Exercise');
            expect(response.body.recurrence_type).toBe('daily');
            expect(response.body.recurrence_interval).toBe(1);
            expect(response.body.completion_based).toBe(false);
        });

        it('should create a weekly recurring task with specific weekday', async () => {
            const taskData = {
                name: 'Weekly Team Meeting',
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 1, // Monday
                priority: 2,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Weekly Team Meeting');
            expect(response.body.recurrence_type).toBe('weekly');
            expect(response.body.recurrence_weekday).toBe(1);
        });

        it('should create a monthly recurring task', async () => {
            const taskData = {
                name: 'Pay Rent',
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: 1,
                priority: 2,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Pay Rent');
            expect(response.body.recurrence_type).toBe('monthly');
            expect(response.body.recurrence_month_day).toBe(1);
        });

        it('should create a monthly weekday recurring task', async () => {
            const taskData = {
                name: 'First Monday Meeting',
                recurrence_type: 'monthly_weekday',
                recurrence_interval: 1,
                recurrence_weekday: 1, // Monday
                recurrence_week_of_month: 1, // First week
                priority: 1,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('First Monday Meeting');
            expect(response.body.recurrence_type).toBe('monthly_weekday');
            expect(response.body.recurrence_weekday).toBe(1);
            expect(response.body.recurrence_week_of_month).toBe(1);
        });

        it('should create a monthly last day recurring task', async () => {
            const taskData = {
                name: 'Month-end Report',
                recurrence_type: 'monthly_last_day',
                recurrence_interval: 1,
                priority: 2,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Month-end Report');
            expect(response.body.recurrence_type).toBe('monthly_last_day');
        });

        it('should create a completion-based recurring task', async () => {
            const taskData = {
                name: 'Car Maintenance',
                recurrence_type: 'monthly',
                recurrence_interval: 3,
                completion_based: true,
                priority: 1,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Car Maintenance');
            expect(response.body.completion_based).toBe(true);
        });

        it('should create recurring task with end date', async () => {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 6);

            const taskData = {
                name: 'Temporary Recurring Task',
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_end_date: endDate.toISOString().split('T')[0],
                priority: 1,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Temporary Recurring Task');
            expect(response.body.recurrence_end_date).toContain(
                endDate.toISOString().split('T')[0]
            );
        });

        it('should default to none recurrence type if not specified', async () => {
            const taskData = {
                name: 'Regular Task',
                priority: 1,
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.recurrence_type).toBe('none');
        });
    });

    describe('PATCH /api/task/:id - Updating recurring tasks', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Test Recurring Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });
        });

        it('should update recurrence settings', async () => {
            const updateData = {
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekday: 5, // Friday
            };

            const response = await agent
                .patch(`/api/task/${task.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.recurrence_type).toBe('weekly');
            expect(response.body.recurrence_interval).toBe(2);
            expect(response.body.recurrence_weekday).toBe(5);
        });

        it('should update completion_based setting', async () => {
            const updateData = {
                completion_based: true,
            };

            const response = await agent
                .patch(`/api/task/${task.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.completion_based).toBe(true);
        });

        it('should update recurrence end date', async () => {
            const endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1);

            const updateData = {
                recurrence_end_date: endDate.toISOString().split('T')[0],
            };

            const response = await agent
                .patch(`/api/task/${task.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.recurrence_end_date).toContain(
                endDate.toISOString().split('T')[0]
            );
        });

        it('should disable recurrence by setting type to none', async () => {
            const updateData = {
                recurrence_type: 'none',
            };

            const response = await agent
                .patch(`/api/task/${task.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.recurrence_type).toBe('none');
        });
    });

    describe('PATCH /api/task/:id - Updating parent recurrence from child task', () => {
        let parentTask, childTask;

        beforeEach(async () => {
            parentTask = await Task.create({
                name: 'Parent Recurring Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });

            childTask = await Task.create({
                name: 'Parent Recurring Task',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                priority: 1,
                due_date: new Date(),
            });
        });

        it('should update parent recurrence settings when update_parent_recurrence is true', async () => {
            const updateData = {
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekday: 3,
                update_parent_recurrence: true,
            };

            const response = await agent
                .patch(`/api/task/${childTask.id}`)
                .send(updateData);

            expect(response.status).toBe(200);

            // Check that parent task was updated
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.recurrence_type).toBe('weekly');
            expect(updatedParent.recurrence_interval).toBe(2);
            expect(updatedParent.recurrence_weekday).toBe(3);
        });

        it('should not update parent when update_parent_recurrence is false', async () => {
            const originalParentType = parentTask.recurrence_type;

            const updateData = {
                recurrence_type: 'weekly',
                update_parent_recurrence: false,
            };

            const response = await agent
                .patch(`/api/task/${childTask.id}`)
                .send(updateData);

            expect(response.status).toBe(200);

            // Check that parent task was not updated
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.recurrence_type).toBe(originalParentType);
        });

        it('should not update parent when task has no recurring_parent_id', async () => {
            const standaloneTask = await Task.create({
                name: 'Standalone Task',
                recurrence_type: 'none',
                user_id: user.id,
                priority: 1,
            });

            const updateData = {
                recurrence_type: 'weekly',
                update_parent_recurrence: true,
            };

            const response = await agent
                .patch(`/api/task/${standaloneTask.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.recurrence_type).toBe('weekly');
        });
    });

    describe('PATCH /api/task/:id/toggle_completion - Recurring task completion', () => {
        it('should create next instance when completing a completion-based recurring task', async () => {
            const recurringTask = await Task.create({
                name: 'Completion Based Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                completion_based: true,
                user_id: user.id,
                status: 0, // NOT_STARTED
            });

            const response = await agent.patch(
                `/api/task/${recurringTask.id}/toggle_completion`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(2); // DONE
            expect(response.body.next_task).toBeDefined();
            expect(response.body.next_task.name).toBe('Completion Based Task');
            expect(response.body.next_task.recurring_parent_id).toBe(
                recurringTask.id
            );
        });

        it('should not create next instance for non-completion-based recurring tasks', async () => {
            const recurringTask = await Task.create({
                name: 'Schedule Based Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                completion_based: false,
                user_id: user.id,
                status: 0, // NOT_STARTED
            });

            const response = await agent.patch(
                `/api/task/${recurringTask.id}/toggle_completion`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(2); // DONE
            expect(response.body.next_task).toBeUndefined();
        });

        it('should not create next instance for non-recurring tasks', async () => {
            const regularTask = await Task.create({
                name: 'Regular Task',
                recurrence_type: 'none',
                user_id: user.id,
                status: 0, // NOT_STARTED
            });

            const response = await agent.patch(
                `/api/task/${regularTask.id}/toggle_completion`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(2); // DONE
            expect(response.body.next_task).toBeUndefined();
        });

        it('should toggle completion back to not done', async () => {
            const task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
                status: 2, // DONE
            });

            const response = await agent.patch(
                `/api/task/${task.id}/toggle_completion`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(0); // NOT_STARTED
        });

        it('should toggle to in_progress if task has a note', async () => {
            const task = await Task.create({
                name: 'Test Task',
                note: 'Some notes',
                user_id: user.id,
                status: 2, // DONE
            });

            const response = await agent.patch(
                `/api/task/${task.id}/toggle_completion`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(1); // IN_PROGRESS
        });
    });

    describe('POST /api/tasks/generate-recurring', () => {
        beforeEach(async () => {
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() - 30); // 30 days ago to ensure generation

            // Find next Monday for weekly task
            const mondayDate = new Date(baseDate);
            while (mondayDate.getDay() !== 1) {
                mondayDate.setDate(mondayDate.getDate() + 1);
            }

            // Create some recurring tasks for testing
            await Task.create({
                name: 'Daily Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                due_date: baseDate,
                last_generated_date: baseDate,
            });

            await Task.create({
                name: 'Weekly Task',
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 1,
                user_id: user.id,
                due_date: mondayDate, // Monday
                last_generated_date: mondayDate,
            });
        });

        it('should generate recurring task instances', async () => {
            const response = await agent.post('/api/tasks/generate-recurring');

            expect(response.status).toBe(200);
            expect(response.body.message).toMatch(
                /Generated \d+ recurring tasks/
            );
            expect(response.body.tasks).toBeDefined();
            expect(Array.isArray(response.body.tasks)).toBe(true);
        });

        it('should require authentication', async () => {
            const response = await request(app).post(
                '/api/tasks/generate-recurring'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should handle errors gracefully', async () => {
            // Mock console.error to suppress expected error log in test output
            const originalConsoleError = console.error;
            console.error = jest.fn();

            // Create invalid recurring task to trigger error
            await Task.create({
                name: 'Invalid Task',
                recurrence_type: 'invalid_type',
                user_id: user.id,
            });

            const response = await agent.post('/api/tasks/generate-recurring');

            // Should still return success even if some tasks fail
            expect(response.status).toBe(200);

            // Restore original console.error
            console.error = originalConsoleError;
        });
    });

    describe('GET /api/tasks - Filtering recurring tasks', () => {
        beforeEach(async () => {
            // Create a mix of regular and recurring tasks
            await Task.create({
                name: 'Regular Task',
                recurrence_type: 'none',
                user_id: user.id,
                status: 0,
            });

            const parentTask = await Task.create({
                name: 'Recurring Parent',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                status: 0,
            });

            await Task.create({
                name: 'Recurring Child',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                status: 0,
            });
        });

        it('should return tasks excluding recurring instances', async () => {
            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();
            expect(response.body.tasks.length).toBe(2);

            const taskNames = response.body.tasks.map((t) => t.name);
            expect(taskNames).toContain('Regular Task');
            expect(taskNames).toContain('Daily'); // Recurring parent shows as "Daily"
            expect(taskNames).not.toContain('Recurring Child'); // Instance should be filtered out
        });

        it('should return task metrics excluding recurring instances', async () => {
            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.metrics).toBeDefined();
            expect(response.body.metrics.total_open_tasks).toBe(2);
        });
    });

    describe('GET /api/task/:id - Retrieving individual recurring tasks', () => {
        let recurringTask;

        beforeEach(async () => {
            recurringTask = await Task.create({
                name: 'Test Recurring Task',
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekday: 1,
                completion_based: true,
                user_id: user.id,
            });
        });

        it('should return recurring task with all recurrence fields', async () => {
            const response = await agent.get(`/api/task/${recurringTask.id}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Test Recurring Task');
            expect(response.body.recurrence_type).toBe('weekly');
            expect(response.body.recurrence_interval).toBe(2);
            expect(response.body.recurrence_weekday).toBe(1);
            expect(response.body.completion_based).toBe(true);
        });
    });

    describe('DELETE /api/task/:id - Deleting recurring tasks', () => {
        let parentTask, childTask;

        beforeEach(async () => {
            parentTask = await Task.create({
                name: 'Parent Recurring Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
            });

            childTask = await Task.create({
                name: 'Child Task Instance',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
            });
        });

        it('should smart delete recurring parent task - remove future instances, orphan past ones', async () => {
            const response = await agent.delete(`/api/task/${parentTask.id}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Task successfully deleted');

            // Verify parent task is deleted
            const deletedParent = await Task.findByPk(parentTask.id);
            expect(deletedParent).toBeNull();

            // Since childTask is NOT_STARTED with no due date, it should be considered future and deleted
            const deletedChild = await Task.findByPk(childTask.id);
            expect(deletedChild).toBeNull();
        });

        it('should delete recurring child task', async () => {
            const response = await agent.delete(`/api/task/${childTask.id}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Task successfully deleted');

            // Verify task is deleted
            const deletedTask = await Task.findByPk(childTask.id);
            expect(deletedTask).toBeNull();

            // Verify parent still exists
            const parentStillExists = await Task.findByPk(parentTask.id);
            expect(parentStillExists).not.toBeNull();
        });
    });
});
