const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Recurring Tasks API', () => {
    let user, agent;

    const toggleTaskCompletion = async (taskId) => {
        const task = await Task.findByPk(taskId);
        const newStatus =
            task.status === Task.STATUS.DONE
                ? task.note
                    ? Task.STATUS.IN_PROGRESS
                    : Task.STATUS.NOT_STARTED
                : Task.STATUS.DONE;

        return agent.patch(`/api/task/${task.uid}`).send({ status: newStatus });
    };

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
                .patch(`/api/task/${task.uid}`)
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
                .patch(`/api/task/${task.uid}`)
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
                .patch(`/api/task/${task.uid}`)
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
                .patch(`/api/task/${task.uid}`)
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
                .patch(`/api/task/${childTask.uid}`)
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
                .patch(`/api/task/${childTask.uid}`)
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
                .patch(`/api/task/${standaloneTask.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.recurrence_type).toBe('weekly');
        });
    });

    describe('PATCH /api/task/:id - Recurring task completion', () => {
        it('should create next instance when completing a completion-based recurring task', async () => {
            const recurringTask = await Task.create({
                name: 'Completion Based Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                completion_based: true,
                user_id: user.id,
                status: 0, // NOT_STARTED
            });

            const response = await toggleTaskCompletion(recurringTask.id);

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

            const response = await toggleTaskCompletion(recurringTask.id);

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

            const response = await toggleTaskCompletion(regularTask.id);

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

            const response = await toggleTaskCompletion(task.id);

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

            const response = await toggleTaskCompletion(task.id);

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
            const response = await agent.get('/api/tasks/metrics');

            expect(response.status).toBe(200);
            expect(response.body.total_open_tasks).toBeDefined();
            expect(response.body.total_open_tasks).toBe(2);
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
            const response = await agent.get(`/api/task/${recurringTask.uid}`);

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
            const response = await agent.delete(`/api/task/${parentTask.uid}`);

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
            const response = await agent.delete(`/api/task/${childTask.uid}`);

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

    describe('GET /api/tasks?type=today - Today view filtering and naming', () => {
        let parentTask, childTask, regularTask;

        beforeEach(async () => {
            // Create a regular non-recurring task
            regularTask = await Task.create({
                name: 'Regular Task',
                recurrence_type: 'none',
                user_id: user.id,
                status: 0,
                today: true,
            });

            // Create a recurring parent task (template)
            parentTask = await Task.create({
                name: 'Take vitamins',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                status: 0,
                today: true,
            });

            // Create a recurring child task (instance)
            childTask = await Task.create({
                name: 'Take vitamins',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                status: 0,
                today: true,
                due_date: new Date(),
            });
        });

        it('should include recurring task instances in type=today API response', async () => {
            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            // Should return at least the regular task + recurring instance
            // Parent tasks should NOT appear in today view
            expect(response.body.tasks.length).toBeGreaterThanOrEqual(2);

            const taskIds = response.body.tasks.map((t) => t.id);
            expect(taskIds).toContain(regularTask.id);
            expect(taskIds).not.toContain(parentTask.id); // Parent should NOT be included
            expect(taskIds).toContain(childTask.id); // Instance should be included
        });

        it('should preserve original names for recurring task instances in type=today API response', async () => {
            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            // Find the recurring task instance in the response
            const recurringInstance = response.body.tasks.find(
                (t) => t.id === childTask.id
            );
            expect(recurringInstance).toBeDefined();

            // Instances should show original name, not "Daily"
            expect(recurringInstance.name).toBe('Take vitamins');
            expect(recurringInstance.original_name).toBe('Take vitamins');
            expect(recurringInstance.name).not.toBe('Daily');
        });

        it('should show generic names for non-today API calls (backward compatibility)', async () => {
            const response = await agent.get('/api/tasks'); // No type=today

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            // Find the recurring task in the response
            const recurringTask = response.body.tasks.find(
                (t) => t.id === parentTask.id
            );
            expect(recurringTask).toBeDefined();

            // Should show generic recurrence name for backward compatibility
            expect(recurringTask.name).toBe('Daily');
            expect(recurringTask.original_name).toBe('Take vitamins');
        });
    });

    describe('Recurring tasks with subtasks', () => {
        it('should copy subtasks when generating recurring task instances', async () => {
            const recurringTaskService = require('../../services/recurringTaskService');

            // Create a recurring task with subtasks
            const taskData = {
                name: 'Weekly grocery shopping',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                priority: 1,
                completion_based: false,
                subtasks: [
                    { name: 'Buy milk', priority: 0 },
                    { name: 'Buy bread', priority: 1 },
                    { name: 'Buy eggs', priority: 0 },
                ],
            };

            const createResponse = await agent.post('/api/task').send(taskData);
            expect(createResponse.status).toBe(201);

            const recurringTaskId = createResponse.body.id;

            // Verify subtasks were created
            const subtasksResponse = await agent.get(
                `/api/task/${recurringTaskId}/subtasks`
            );
            expect(subtasksResponse.status).toBe(200);
            expect(subtasksResponse.body.length).toBe(3);

            // Generate recurring task instances
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            await recurringTaskService.generateRecurringTasks(user.id, 2);

            // Find the generated instance
            const instances = await Task.findAll({
                where: {
                    user_id: user.id,
                    recurring_parent_id: recurringTaskId,
                },
            });

            expect(instances.length).toBeGreaterThan(0);

            const firstInstance = instances[0];

            // Check if subtasks were copied to the instance
            const instanceSubtasksResponse = await agent.get(
                `/api/task/${firstInstance.id}/subtasks`
            );
            expect(instanceSubtasksResponse.status).toBe(200);
            expect(instanceSubtasksResponse.body.length).toBe(3);

            // Verify subtask names match
            const subtaskNames = instanceSubtasksResponse.body.map(
                (s) => s.name
            );
            expect(subtaskNames).toContain('Buy milk');
            expect(subtaskNames).toContain('Buy bread');
            expect(subtaskNames).toContain('Buy eggs');

            // Verify all subtasks are in NOT_STARTED status
            instanceSubtasksResponse.body.forEach((subtask) => {
                expect(subtask.status).toBe(Task.STATUS.NOT_STARTED);
            });
        });
    });

    describe('Recurring tasks in Today view', () => {
        it('should show recurring task instances in type=today API response', async () => {
            const recurringTaskService = require('../../services/recurringTaskService');

            // Create a recurring daily task with due date today
            const today = new Date();
            today.setHours(12, 0, 0, 0);

            const taskData = {
                name: 'Daily standup meeting',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today.toISOString(),
                priority: 1,
                completion_based: false,
            };

            const createResponse = await agent.post('/api/task').send(taskData);
            expect(createResponse.status).toBe(201);

            const recurringTaskId = createResponse.body.id;

            // Generate recurring task instances
            await recurringTaskService.generateRecurringTasks(user.id, 2);

            // Verify instances were created
            const instances = await Task.findAll({
                where: {
                    user_id: user.id,
                    recurring_parent_id: recurringTaskId,
                },
            });

            expect(instances.length).toBeGreaterThan(0);

            // Fetch tasks with type=today
            const todayResponse = await agent.get('/api/tasks?type=today');
            expect(todayResponse.status).toBe(200);

            // Find the recurring task instance in the today response
            const todayTasks = todayResponse.body.tasks;

            // Check if we have the recurring instance (but not the parent)
            const recurringTasksInToday = todayTasks.filter(
                (task) => task.recurring_parent_id === recurringTaskId
            );

            // Should find at least one instance (the one due today)
            expect(recurringTasksInToday.length).toBeGreaterThan(0);

            // Verify at least one task with this name appears
            const taskWithName = todayTasks.find(
                (task) => task.name === 'Daily standup meeting'
            );
            expect(taskWithName).toBeDefined();
            expect(taskWithName.recurring_parent_id).toBe(recurringTaskId);
        });

        it('should include recurring_parent_uid in serialized task instances', async () => {
            const today = new Date();
            const taskResponse = await agent.post('/api/task').send({
                name: 'Recurring parent test',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today.toISOString().split('T')[0],
            });

            expect(taskResponse.status).toBe(201);
            const recurringTask = taskResponse.body;

            await agent.post('/api/tasks/generate-recurring');

            // Find the generated instance
            const generatedInstance = await Task.findOne({
                where: {
                    user_id: user.id,
                    recurring_parent_id: recurringTask.id,
                },
            });

            expect(generatedInstance).toBeDefined();

            const response = await agent.get('/api/tasks?type=today');
            expect(response.status).toBe(200);

            const instance = response.body.tasks.find(
                (task) => task.recurring_parent_id === recurringTask.id
            );

            expect(instance).toBeDefined();
            expect(instance.recurring_parent_uid).toBeDefined();
            expect(instance.recurring_parent_uid).toBe(recurringTask.uid);
        });
    });
});
