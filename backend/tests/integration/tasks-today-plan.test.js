const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks Today Plan - Status-Based Filtering', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'todayplan@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'todayplan@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/tasks?type=today&include_lists=true - tasks_today_plan', () => {
        it('should return tasks with status in_progress, planned, and waiting', async () => {
            // Create tasks with different statuses
            const inProgressTask = await Task.create({
                name: 'In Progress Task',
                user_id: user.id,
                status: Task.STATUS.IN_PROGRESS,
                today: false, // Deliberately false to verify it doesn't depend on 'today' field
            });

            const plannedTask = await Task.create({
                name: 'Planned Task',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                today: false,
            });

            const waitingTask = await Task.create({
                name: 'Waiting Task',
                user_id: user.id,
                status: Task.STATUS.WAITING,
                today: false,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            expect(response.body.tasks_today_plan).toHaveLength(3);

            const taskIds = response.body.tasks_today_plan.map((t) => t.id);
            expect(taskIds).toContain(inProgressTask.id);
            expect(taskIds).toContain(plannedTask.id);
            expect(taskIds).toContain(waitingTask.id);
        });

        it('should exclude tasks with status not_started', async () => {
            await Task.create({
                name: 'Not Started Task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                today: true, // Even with today=true, should not appear in tasks_today_plan
            });

            await Task.create({
                name: 'In Progress Task',
                user_id: user.id,
                status: Task.STATUS.IN_PROGRESS,
                today: false,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            expect(response.body.tasks_today_plan).toHaveLength(1);
            expect(response.body.tasks_today_plan[0].name).toBe(
                'In Progress Task'
            );
        });

        it('should exclude tasks with status done, archived, and cancelled', async () => {
            await Task.create({
                name: 'Done Task',
                user_id: user.id,
                status: Task.STATUS.DONE,
                today: true,
            });

            await Task.create({
                name: 'Archived Task',
                user_id: user.id,
                status: Task.STATUS.ARCHIVED,
                today: true,
            });

            await Task.create({
                name: 'Cancelled Task',
                user_id: user.id,
                status: Task.STATUS.CANCELLED,
                today: true,
            });

            await Task.create({
                name: 'Planned Task',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                today: false,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            expect(response.body.tasks_today_plan).toHaveLength(1);
            expect(response.body.tasks_today_plan[0].name).toBe('Planned Task');
        });

        it('should exclude subtasks from tasks_today_plan', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: user.id,
                status: Task.STATUS.IN_PROGRESS,
            });

            await Task.create({
                name: 'Subtask',
                user_id: user.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.IN_PROGRESS,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            expect(response.body.tasks_today_plan).toHaveLength(1);
            expect(response.body.tasks_today_plan[0].id).toBe(parentTask.id);
        });

        it('should exclude recurring parent tasks from tasks_today_plan', async () => {
            const recurringParent = await Task.create({
                name: 'Recurring Parent',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                recurrence_type: 'daily',
            });

            await Task.create({
                name: 'Recurring Instance',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                recurring_parent_id: recurringParent.id,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            // Should only include the instance, not the parent
            const taskNames = response.body.tasks_today_plan.map((t) => t.name);
            expect(taskNames).not.toContain('Recurring Parent');
            expect(taskNames).toContain('Recurring Instance');
        });

        it('should work independently of the today field', async () => {
            // Task with status PLANNED but today=false
            const plannedTask = await Task.create({
                name: 'Planned Not Today',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                today: false,
            });

            // Task with status NOT_STARTED but today=true
            await Task.create({
                name: 'Not Started Today',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                today: true,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            expect(response.body.tasks_today_plan).toHaveLength(1);
            expect(response.body.tasks_today_plan[0].id).toBe(plannedTask.id);
        });

        it('should return empty array when no planned tasks exist', async () => {
            await Task.create({
                name: 'Not Started Task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            await Task.create({
                name: 'Done Task',
                user_id: user.id,
                status: Task.STATUS.DONE,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            expect(response.body.tasks_today_plan).toHaveLength(0);
        });

        it('should order tasks by priority DESC, due_date ASC, project_id ASC', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);

            await Task.create({
                name: 'Low Priority',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                priority: Task.PRIORITY.LOW,
            });

            await Task.create({
                name: 'High Priority Due Later',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                priority: Task.PRIORITY.HIGH,
                due_date: nextWeek,
            });

            await Task.create({
                name: 'High Priority Due Soon',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                priority: Task.PRIORITY.HIGH,
                due_date: tomorrow,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            expect(response.body.tasks_today_plan).toHaveLength(3);

            const taskNames = response.body.tasks_today_plan.map((t) => t.name);
            // High priority tasks should come first, ordered by due date
            expect(taskNames[0]).toBe('High Priority Due Soon');
            expect(taskNames[1]).toBe('High Priority Due Later');
            expect(taskNames[2]).toBe('Low Priority');
        });
    });
});
