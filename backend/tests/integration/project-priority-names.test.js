const request = require('supertest');
const app = require('../../app');
const { Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Project priority names', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'priority@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'priority@example.com',
            password: 'password123',
        });
    });

    it('stores a priority name sent on create as its number', async () => {
        const res = await agent
            .post('/api/project')
            .send({ name: 'Onboarding', priority: 'low' });

        expect(res.status).toBe(201);
        const project = await Project.findOne({ where: { uid: res.body.uid } });
        expect(project.priority).toBe(0);
    });

    it('stores a priority name sent on update as its number', async () => {
        const created = await agent
            .post('/api/project')
            .send({ name: 'Onboarding' });

        const res = await agent
            .patch(`/api/project/${created.body.uid}`)
            .send({ priority: 'high' });

        expect(res.status).toBe(200);
        expect(res.body.priority).toBe(2);
    });

    it('still accepts a number and clears with an empty value', async () => {
        const created = await agent
            .post('/api/project')
            .send({ name: 'Onboarding', priority: 1 });
        expect(created.body.priority).toBe(1);

        const res = await agent
            .patch(`/api/project/${created.body.uid}`)
            .send({ priority: null });

        expect(res.status).toBe(200);
        expect(res.body.priority).toBeNull();
    });
});
