const request = require('supertest');
const app = require('../../app');
const { Task, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Recurring Task Display Fixes', () => {
    let user, project, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        project = await Project.create({
            name: 'Test Project',
            user_id: user.id,
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('Recurrence Type Display Names', () => {
        it('should show "Daily" instead of recurring task template name', async () => {
            const recurringTemplate = await Task.create({
                name: 'Daily Workout Original Name',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            const task = response.body.tasks.find(
                (t) => t.id === recurringTemplate.id
            );
            expect(task).toBeDefined();
            expect(task.name).toBe('Daily');
            expect(task.original_name).toBe('Daily Workout Original Name');
            expect(task.recurrence_type).toBe('daily');
        });

        it('should show "Weekly" for weekly recurring tasks', async () => {
            const weeklyTask = await Task.create({
                name: 'Weekly Review Task',
                user_id: user.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            const task = response.body.tasks.find(
                (t) => t.id === weeklyTask.id
            );
            expect(task).toBeDefined();
            expect(task.name).toBe('Weekly');
            expect(task.original_name).toBe('Weekly Review Task');
        });

        it('should show "Monthly" for monthly recurring tasks', async () => {
            const monthlyTask = await Task.create({
                name: 'Monthly Report',
                user_id: user.id,
                recurrence_type: 'monthly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            const task = response.body.tasks.find(
                (t) => t.id === monthlyTask.id
            );
            expect(task).toBeDefined();
            expect(task.name).toBe('Monthly');
            expect(task.original_name).toBe('Monthly Report');
        });

        it('should show "Yearly" for yearly recurring tasks', async () => {
            const yearlyTask = await Task.create({
                name: 'Annual Tax Filing',
                user_id: user.id,
                recurrence_type: 'yearly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            const task = response.body.tasks.find(
                (t) => t.id === yearlyTask.id
            );
            expect(task).toBeDefined();
            expect(task.name).toBe('Yearly');
            expect(task.original_name).toBe('Annual Tax Filing');
        });

        it('should not modify names of non-recurring tasks', async () => {
            const regularTask = await Task.create({
                name: 'Regular Task Name',
                user_id: user.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            const task = response.body.tasks.find(
                (t) => t.id === regularTask.id
            );
            expect(task).toBeDefined();
            expect(task.name).toBe('Regular Task Name');
            expect(task.original_name).toBe('Regular Task Name');
        });

        it('should not modify names of recurring task instances', async () => {
            const template = await Task.create({
                name: 'Template Task',
                user_id: user.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const instance = await Task.create({
                name: 'Daily Instance - Aug 23',
                user_id: user.id,
                recurrence_type: 'none',
                recurring_parent_id: template.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Since instances are filtered out, we won't see them in the response
            // But if they were included, they should keep their original name
            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            const templateTask = response.body.tasks.find(
                (t) => t.id === template.id
            );
            const instanceTask = response.body.tasks.find(
                (t) => t.id === instance.id
            );

            expect(templateTask).toBeDefined();
            expect(templateTask.name).toBe('Daily'); // Template shows "Daily"
            expect(instanceTask).toBeUndefined(); // Instance should be filtered out
        });
    });

    describe('Past Missed Recurring Tasks Filtering', () => {
        it('should hide recurring templates with past due dates', async () => {
            const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
            const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

            // Past recurring template (should be hidden)
            const pastRecurring = await Task.create({
                name: 'Past Daily Task',
                user_id: user.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                due_date: pastDate,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Future recurring template (should be shown)
            const futureRecurring = await Task.create({
                name: 'Future Daily Task',
                user_id: user.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                due_date: futureDate,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Past regular task (should still be shown - overdue tasks are allowed)
            const pastRegular = await Task.create({
                name: 'Past Regular Task',
                user_id: user.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                due_date: pastDate,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);

            const taskIds = response.body.tasks.map((t) => t.id);
            const taskNames = response.body.tasks.map((t) => t.name);

            // Past recurring template should be hidden
            expect(taskIds).not.toContain(pastRecurring.id);

            // Future recurring template should be shown as "Daily"
            expect(taskIds).toContain(futureRecurring.id);
            expect(taskNames).toContain('Daily');

            // Past regular task should still be shown (overdue tasks are allowed for non-recurring)
            expect(taskIds).toContain(pastRegular.id);
            expect(taskNames).toContain('Past Regular Task');
        });

        it('should show recurring templates with no due date', async () => {
            const recurringNoDueDate = await Task.create({
                name: 'No Due Date Recurring',
                user_id: user.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                due_date: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);

            const taskIds = response.body.tasks.map((t) => t.id);
            const taskNames = response.body.tasks.map((t) => t.name);

            expect(taskIds).toContain(recurringNoDueDate.id);
            expect(taskNames).toContain('Weekly');
        });

        it('should show recurring templates due today', async () => {
            const today = new Date();
            today.setHours(12, 0, 0, 0); // Set to noon today

            const todayRecurring = await Task.create({
                name: 'Today Recurring Task',
                user_id: user.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                due_date: today,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);

            const taskIds = response.body.tasks.map((t) => t.id);
            const taskNames = response.body.tasks.map((t) => t.name);

            expect(taskIds).toContain(todayRecurring.id);
            expect(taskNames).toContain('Daily');
        });
    });

    describe('Task By UID Endpoint', () => {
        it('should return actual task name when fetching recurring task by UID', async () => {
            const recurringTask = await Task.create({
                name: 'My Weekly Review',
                user_id: user.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get(`/api/task/${recurringTask.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('My Weekly Review');
            expect(response.body.original_name).toBe('My Weekly Review');
            expect(response.body.recurrence_type).toBe('weekly');
        });

        it('should return actual task name for monthly recurring task by UID', async () => {
            const monthlyTask = await Task.create({
                name: 'Monthly Budget Review',
                user_id: user.id,
                recurrence_type: 'monthly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const response = await agent.get(`/api/task/${monthlyTask.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Monthly Budget Review');
            expect(response.body.original_name).toBe('Monthly Budget Review');
            expect(response.body.recurrence_type).toBe('monthly');
        });
    });
});
