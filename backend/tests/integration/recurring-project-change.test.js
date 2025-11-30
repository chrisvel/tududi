const request = require('supertest');
const app = require('../../app');
const { Task, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Recurring Task Project Change', () => {
    let user, agent, project;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'recurring-project-test@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'recurring-project-test@example.com',
            password: 'password123',
        });

        // Create a project
        project = await Project.create({
            user_id: user.id,
            name: 'Test Project',
        });
    });

    it('should regenerate instances when project_id changes on recurring template', async () => {
        // Create a daily recurring task without project
        const taskResponse = await agent.post('/api/task').send({
            name: 'Daily Task',
            status: 'not_started',
            recurrence_type: 'daily',
            recurrence_interval: 1,
            due_date: new Date().toISOString(),
        });

        expect(taskResponse.status).toBe(201);
        const taskId = taskResponse.body.id;
        const taskUid = taskResponse.body.uid;

        // Generate instances
        await agent.post('/api/tasks/generate-recurring');

        // Count instances without project
        const instancesBeforeCount = await Task.count({
            where: {
                user_id: user.id,
                recurring_parent_id: taskId,
            },
        });

        expect(instancesBeforeCount).toBeGreaterThan(0);

        // Verify all instances have no project
        const instancesBefore = await Task.findAll({
            where: {
                user_id: user.id,
                recurring_parent_id: taskId,
            },
        });
        instancesBefore.forEach((instance) => {
            expect(instance.project_id).toBeNull();
        });

        // Update the template to add project_id
        const updateResponse = await agent.patch(`/api/task/${taskUid}`).send({
            project_id: project.id,
        });

        expect(updateResponse.status).toBe(200);

        // Wait for regeneration
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Count instances after update
        const instancesAfter = await Task.findAll({
            where: {
                user_id: user.id,
                recurring_parent_id: taskId,
                due_date: { [require('sequelize').Op.gt]: new Date() },
            },
        });

        // All future instances should now have the project_id
        instancesAfter.forEach((instance) => {
            expect(instance.project_id).toBe(project.id);
        });
    });
});
