const request = require('supertest');
const app = require('../../app');
const { Task, Project, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Project Details - Recurring Task Filtering', () => {
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

    describe('GET /api/project/:uidSlug - Recurring task filtering', () => {
        it('should only show recurring task templates, not instances', async () => {
            // Create a recurring parent task (template)
            const recurringTemplate = await Task.create({
                name: 'Daily Standup Template',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                recurring_parent_id: null, // This is the template
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create generated recurring task instances
            const instance1 = await Task.create({
                name: 'Daily Standup - Aug 19',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: recurringTemplate.id, // This is an instance
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const instance2 = await Task.create({
                name: 'Daily Standup - Aug 20',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: recurringTemplate.id, // This is an instance
                status: Task.STATUS.DONE,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create a regular (non-recurring) task
            const regularTask = await Task.create({
                name: 'Code Review',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.HIGH,
            });

            // Create a subtask (should be excluded anyway)
            const subtask = await Task.create({
                name: 'Subtask of regular task',
                user_id: user.id,
                project_id: project.id,
                parent_task_id: regularTask.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.LOW,
            });

            const uidSlug = `${project.uid}-${project.name.toLowerCase().replace(/\s+/g, '-')}`;
            const response = await agent.get(`/api/project/${uidSlug}`);

            expect(response.status).toBe(200);
            expect(response.body.Tasks).toBeDefined();

            // Extract task names for easier assertion
            const taskNames = response.body.Tasks.map((t) => t.name).sort();
            const taskIds = response.body.Tasks.map((t) => t.id);

            // Should include the recurring template and regular task
            expect(taskNames).toContain('Daily Standup Template');
            expect(taskNames).toContain('Code Review');

            // Should NOT include the recurring instances
            expect(taskNames).not.toContain('Daily Standup - Aug 19');
            expect(taskNames).not.toContain('Daily Standup - Aug 20');

            // Should NOT include subtasks
            expect(taskNames).not.toContain('Subtask of regular task');

            // Verify by IDs too
            expect(taskIds).toContain(recurringTemplate.id);
            expect(taskIds).toContain(regularTask.id);
            expect(taskIds).not.toContain(instance1.id);
            expect(taskIds).not.toContain(instance2.id);
            expect(taskIds).not.toContain(subtask.id);

            // Should have exactly 2 tasks (template + regular)
            expect(response.body.Tasks.length).toBe(2);

            // Verify the recurring template has correct properties
            const returnedTemplate = response.body.Tasks.find(
                (t) => t.id === recurringTemplate.id
            );
            expect(returnedTemplate).toBeDefined();
            expect(returnedTemplate.recurrence_type).toBe('daily');
            expect(returnedTemplate.recurring_parent_id).toBeNull();
        });

        it('should handle projects with no recurring tasks correctly', async () => {
            // Create only regular tasks
            const task1 = await Task.create({
                name: 'Regular Task 1',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const task2 = await Task.create({
                name: 'Regular Task 2',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                status: Task.STATUS.DONE,
                priority: Task.PRIORITY.LOW,
            });

            const uidSlug = `${project.uid}-${project.name.toLowerCase().replace(/\s+/g, '-')}`;
            const response = await agent.get(`/api/project/${uidSlug}`);

            expect(response.status).toBe(200);
            expect(response.body.Tasks).toBeDefined();
            expect(response.body.Tasks.length).toBe(2);

            const taskNames = response.body.Tasks.map((t) => t.name).sort();
            expect(taskNames).toEqual(['Regular Task 1', 'Regular Task 2']);
        });

        it('should handle projects with only recurring instances correctly', async () => {
            // Create a recurring template in a different project
            const otherProject = await Project.create({
                name: 'Other Project',
                user_id: user.id,
            });

            const recurringTemplate = await Task.create({
                name: 'Template in other project',
                user_id: user.id,
                project_id: otherProject.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create instances in our test project
            await Task.create({
                name: 'Instance 1',
                user_id: user.id,
                project_id: project.id, // In test project
                recurrence_type: 'none',
                recurring_parent_id: recurringTemplate.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            await Task.create({
                name: 'Instance 2',
                user_id: user.id,
                project_id: project.id, // In test project
                recurrence_type: 'none',
                recurring_parent_id: recurringTemplate.id,
                status: Task.STATUS.DONE,
                priority: Task.PRIORITY.MEDIUM,
            });

            const uidSlug = `${project.uid}-${project.name.toLowerCase().replace(/\s+/g, '-')}`;
            const response = await agent.get(`/api/project/${uidSlug}`);

            expect(response.status).toBe(200);
            expect(response.body.Tasks).toBeDefined();

            // Should have no tasks since all are instances (excluded)
            expect(response.body.Tasks.length).toBe(0);
        });
    });
});
