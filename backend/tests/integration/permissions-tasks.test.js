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

    it("GET /api/task?uid=... should return 403 for other user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
        });

        const res = await agent.get(`/api/task?uid=${otherTask.uid}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("PATCH /api/task/:id/toggle_completion should return 403 for other user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
        });

        const res = await agent
            .patch(`/api/task/${otherTask.id}/toggle_completion`)
            .send({});
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("PATCH /api/task/:id/toggle-today should return 403 for other user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
        });

        const res = await agent
            .patch(`/api/task/${otherTask.id}/toggle-today`)
            .send({});
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
            .patch(`/api/task/${myTask.id}`)
            .send({ project_id: otherProject.id });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });
});
