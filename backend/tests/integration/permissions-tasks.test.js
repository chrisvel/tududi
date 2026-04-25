const request = require('supertest');
const app = require('../../app');
const { Task, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks Permissions', () => {
    let user, otherUser, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `user_${Date.now()}@example.com`,
        });
        otherUser = await createTestUser({
            email: `other_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it("GET /api/task/:id should return 403 for other user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
        });

        const res = await agent.get(`/api/task/${otherTask.id}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("GET /api/task/:uid should return 403 for other user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
        });

        const res = await agent.get(`/api/task/${otherTask.uid}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("PATCH /api/task/:id (status) should return 403 for other user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
            status: 0,
        });

        const res = await agent
            .patch(`/api/task/${otherTask.uid}`)
            .send({ status: 2 });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("PATCH /api/task/:id (today) should return 403 for other user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
            today: false,
        });

        const res = await agent
            .patch(`/api/task/${otherTask.uid}`)
            .send({ today: true });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("POST /api/task should return 403 when assigning to other user's project", async () => {
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });

        const res = await agent
            .post('/api/task')
            .send({ name: 'My Task', project_id: otherProject.id });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("PATCH /api/task/:id should return 403 when reassigning to other user's project", async () => {
        const myTask = await Task.create({ name: 'My Task', user_id: user.id });
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });

        const res = await agent
            .patch(`/api/task/${myTask.uid}`)
            .send({ project_id: otherProject.id });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("GET /api/tasks/metrics should not include another user's projectless in-progress task", async () => {
        const myTask = await Task.create({
            name: 'My In Progress Task',
            user_id: user.id,
            status: Task.STATUS.IN_PROGRESS,
        });
        const otherTask = await Task.create({
            name: 'Other In Progress Task',
            user_id: otherUser.id,
            status: Task.STATUS.IN_PROGRESS,
        });

        const res = await agent.get('/api/tasks/metrics');
        expect(res.status).toBe(200);

        const taskIds = res.body.tasks_in_progress.map((task) => task.id);
        expect(taskIds).toContain(myTask.id);
        expect(taskIds).not.toContain(otherTask.id);
    });

    it("GET /api/tasks/metrics should not suggest another user's projectless task", async () => {
        await Task.bulkCreate([
            {
                name: 'My Task 1',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            },
            {
                name: 'My Task 2',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            },
            {
                name: 'My Task 3',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            },
        ]);
        const otherTask = await Task.create({
            name: 'Other Suggested Task',
            user_id: otherUser.id,
            status: Task.STATUS.NOT_STARTED,
        });

        const res = await agent.get('/api/tasks/metrics');
        expect(res.status).toBe(200);

        const suggestedTaskIds = res.body.suggested_tasks.map(
            (task) => task.id
        );
        expect(suggestedTaskIds).not.toContain(otherTask.id);
    });
});
