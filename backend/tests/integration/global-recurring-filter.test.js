const request = require('supertest');
const app = require('../../app');
const { Task, Project, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Global Recurring Task Instance Filtering', () => {
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

    describe('GET /api/tasks - All task views should exclude recurring instances', () => {
        let recurringTemplate, instance1, instance2, regularTask;

        beforeEach(async () => {
            // Create a recurring parent task (template)
            recurringTemplate = await Task.create({
                name: 'Daily Workout Template',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                recurring_parent_id: null, // This is the template
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
                due_date: new Date('2025-08-25'), // Future date
            });

            // Create generated recurring task instances
            instance1 = await Task.create({
                name: 'Daily Workout - Aug 23',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: recurringTemplate.id, // This is an instance
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
                due_date: new Date('2025-08-23'),
            });

            instance2 = await Task.create({
                name: 'Daily Workout - Aug 24',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: recurringTemplate.id, // This is an instance
                status: Task.STATUS.DONE,
                priority: Task.PRIORITY.MEDIUM,
                due_date: new Date('2025-08-24'),
                completed_at: new Date(),
            });

            // Create a regular (non-recurring) task
            regularTask = await Task.create({
                name: 'Regular Task',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.HIGH,
            });
        });

        it('should exclude recurring instances from default tasks view', async () => {
            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            const taskNames = response.body.tasks.map((t) => t.name);
            const taskIds = response.body.tasks.map((t) => t.id);

            // Should include the recurring template and regular task
            expect(taskNames).toContain('Daily Workout Template');
            expect(taskNames).toContain('Regular Task');

            // Should NOT include the recurring instances
            expect(taskNames).not.toContain('Daily Workout - Aug 23');
            expect(taskNames).not.toContain('Daily Workout - Aug 24');

            // Verify by IDs too
            expect(taskIds).toContain(recurringTemplate.id);
            expect(taskIds).toContain(regularTask.id);
            expect(taskIds).not.toContain(instance1.id);
            expect(taskIds).not.toContain(instance2.id);
        });

        it('should exclude recurring instances from today tasks view', async () => {
            // Set today flag on template and regular task
            await recurringTemplate.update({ today: true });
            await regularTask.update({ today: true });
            await instance1.update({ today: true }); // This should be filtered out

            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            const taskNames = response.body.tasks.map((t) => t.name);
            expect(taskNames).toContain('Daily Workout Template');
            expect(taskNames).toContain('Regular Task');
            expect(taskNames).not.toContain('Daily Workout - Aug 23');
            expect(taskNames).not.toContain('Daily Workout - Aug 24');
        });

        it('should exclude recurring instances from upcoming tasks view', async () => {
            const response = await agent.get('/api/tasks?type=upcoming');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            const taskNames = response.body.tasks.map((t) => t.name);

            // Only the template with future due date should appear
            expect(taskNames).toContain('Daily Workout Template');

            // Instances should not appear even with due dates in the upcoming range
            expect(taskNames).not.toContain('Daily Workout - Aug 23');
            expect(taskNames).not.toContain('Daily Workout - Aug 24');
        });

        it('should exclude recurring instances from someday tasks view', async () => {
            // Remove due dates to make them "someday" tasks
            await recurringTemplate.update({ due_date: null });
            await regularTask.update({ due_date: null });
            await instance1.update({ due_date: null });

            const response = await agent.get('/api/tasks?type=someday');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            const taskNames = response.body.tasks.map((t) => t.name);
            expect(taskNames).toContain('Daily Workout Template');
            expect(taskNames).toContain('Regular Task');
            expect(taskNames).not.toContain('Daily Workout - Aug 23');
        });

        it('should exclude recurring instances from task metrics', async () => {
            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.metrics).toBeDefined();

            // Check that metrics don't include recurring instances
            const tasksInProgressIds =
                response.body.metrics.tasks_in_progress.map((t) => t.id);
            const tasksDueTodayIds = response.body.metrics.tasks_due_today.map(
                (t) => t.id
            );
            const suggestedTasksIds = response.body.metrics.suggested_tasks.map(
                (t) => t.id
            );

            // None of the metrics should include instance IDs
            expect(tasksInProgressIds).not.toContain(instance1.id);
            expect(tasksInProgressIds).not.toContain(instance2.id);
            expect(tasksDueTodayIds).not.toContain(instance1.id);
            expect(tasksDueTodayIds).not.toContain(instance2.id);
            expect(suggestedTasksIds).not.toContain(instance1.id);
            expect(suggestedTasksIds).not.toContain(instance2.id);
        });

        it('should handle mixed scenarios correctly', async () => {
            // Create another recurring template with different settings
            const anotherTemplate = await Task.create({
                name: 'Weekly Review Template',
                user_id: user.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.LOW,
            });

            // Create an instance of the new template
            const anotherInstance = await Task.create({
                name: 'Weekly Review - This Week',
                user_id: user.id,
                recurrence_type: 'none',
                recurring_parent_id: anotherTemplate.id,
                status: Task.STATUS.IN_PROGRESS,
                priority: Task.PRIORITY.LOW,
            });

            const response = await agent.get('/api/tasks');

            expect(response.status).toBe(200);

            const taskNames = response.body.tasks.map((t) => t.name);

            // Should include both templates
            expect(taskNames).toContain('Daily Workout Template');
            expect(taskNames).toContain('Weekly Review Template');
            expect(taskNames).toContain('Regular Task');

            // Should exclude all instances
            expect(taskNames).not.toContain('Daily Workout - Aug 23');
            expect(taskNames).not.toContain('Daily Workout - Aug 24');
            expect(taskNames).not.toContain('Weekly Review - This Week');
        });
    });
});
