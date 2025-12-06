const request = require('supertest');
const app = require('../../app');
const { Project, Task, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Editing in Shared Projects', () => {
    let ownerUser, sharedUser, ownerAgent, sharedUserAgent, project;

    beforeEach(async () => {
        // Create test users
        ownerUser = await createTestUser({
            email: `owner_${Date.now()}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });

        sharedUser = await createTestUser({
            email: `shared_${Date.now()}@test.com`,
            name: 'Shared User',
            timezone: 'UTC',
        });

        // Create agents for both users
        ownerAgent = request.agent(app);
        sharedUserAgent = request.agent(app);

        // Login as owner
        await ownerAgent
            .post('/api/login')
            .send({ email: ownerUser.email, password: 'password123' });

        // Login as shared user
        await sharedUserAgent
            .post('/api/login')
            .send({ email: sharedUser.email, password: 'password123' });

        // Create a project as owner
        const projectResponse = await ownerAgent.post('/api/project').send({
            name: 'Shared Test Project',
            description: 'Project for sharing tests',
        });
        project = projectResponse.body;

        // Share the project with read-write access
        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: sharedUser.email,
            access_level: 'rw',
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    test('shared user with RW access can edit task name in shared project', async () => {
        // Owner creates a task in the shared project
        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Original Task Name',
            project_id: project.id,
            priority: 1,
            status: 0,
        });
        const task = taskResponse.body;

        // Shared user should be able to edit the task name
        const response = await sharedUserAgent
            .patch(`/api/task/${task.uid}`)
            .send({
                name: 'Updated Task Name',
            });

        console.log('Response status:', response.status);
        console.log('Response body:', response.body);

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Updated Task Name');
    });

    test('shared user with RW access can edit task priority in shared project', async () => {
        // Owner creates a task in the shared project
        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Test Task',
            project_id: project.id,
            priority: 1,
            status: 0,
        });
        const task = taskResponse.body;

        // Shared user should be able to edit the task priority
        const response = await sharedUserAgent
            .patch(`/api/task/${task.uid}`)
            .send({
                priority: 2,
            });

        expect(response.status).toBe(200);
        expect(response.body.priority).toBe(2);
    });

    test('shared user with RW access can toggle task completion in shared project', async () => {
        // Owner creates a task in the shared project
        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Test Task',
            project_id: project.id,
            priority: 1,
            status: 0,
        });
        const task = taskResponse.body;

        // Shared user should be able to update task status
        const response = await sharedUserAgent
            .patch(`/api/task/${task.uid}`)
            .send({ status: 2 });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(2);
    });

    test('shared user created task can be edited by them in shared project', async () => {
        // Shared user creates a task in the shared project
        const taskResponse = await sharedUserAgent.post('/api/task').send({
            name: 'Task by Shared User',
            project_id: project.id,
            priority: 1,
            status: 0,
        });
        const task = taskResponse.body;

        // Shared user should be able to edit their own task
        const response = await sharedUserAgent
            .patch(`/api/task/${task.uid}`)
            .send({
                name: 'Updated by Shared User',
            });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Updated by Shared User');
    });
});
