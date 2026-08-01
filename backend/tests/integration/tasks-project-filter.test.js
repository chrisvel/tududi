const request = require('supertest');
const app = require('../../app');
const { Task, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks API project_id filter', () => {
    let user, agent, projectA, projectB;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'project-filter-test@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'project-filter-test@example.com',
            password: 'password123',
        });

        projectA = await Project.create({
            name: 'Project A',
            user_id: user.id,
        });
        projectB = await Project.create({
            name: 'Project B',
            user_id: user.id,
        });

        await Task.create({
            user_id: user.id,
            name: 'Task in A',
            status: 0,
            project_id: projectA.id,
        });
        await Task.create({
            user_id: user.id,
            name: 'Task in B',
            status: 0,
            project_id: projectB.id,
        });
        await Task.create({
            user_id: user.id,
            name: 'Done Task in A',
            status: 2,
            project_id: projectA.id,
        });
        await Task.create({
            user_id: user.id,
            name: 'No project task',
            status: 0,
        });
    });

    it('should filter tasks by project_id', async () => {
        const response = await agent.get('/api/tasks').query({
            type: 'all',
            project_id: projectA.id,
        });

        expect(response.status).toBe(200);
        const names = response.body.tasks.map((t) => t.name);
        expect(names).toContain('Task in A');
        expect(names).not.toContain('Task in B');
        expect(names).not.toContain('No project task');
    });

    it('should filter tasks by project_uid', async () => {
        const response = await agent.get('/api/tasks').query({
            type: 'all',
            project_uid: projectB.uid,
        });

        expect(response.status).toBe(200);
        const names = response.body.tasks.map((t) => t.name);
        expect(names).toContain('Task in B');
        expect(names).not.toContain('Task in A');
        expect(names).not.toContain('No project task');
    });

    it('should return all statuses when type=all and status=all', async () => {
        const response = await agent.get('/api/tasks').query({
            type: 'all',
            project_id: projectA.id,
            status: 'all',
        });

        expect(response.status).toBe(200);
        const names = response.body.tasks.map((t) => t.name);
        expect(names).toContain('Task in A');
        expect(names).toContain('Done Task in A');
    });

    it('should only return active tasks by default with type=all and project_id', async () => {
        const response = await agent.get('/api/tasks').query({
            type: 'all',
            project_id: projectA.id,
        });

        expect(response.status).toBe(200);
        const names = response.body.tasks.map((t) => t.name);
        expect(names).toContain('Task in A');
        expect(names).not.toContain('Done Task in A');
    });
});
