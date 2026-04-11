const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Delegation Plan Routes', () => {
    let user;
    let agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `delegate_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    it('generates a delegation plan for an authenticated user task', async () => {
        const taskResponse = await agent.post('/api/task').send({
            name: 'Plan spring fundraiser',
            note: 'Need venue, volunteers, sponsors, and social media promotion.',
            priority: 'high',
        });

        expect(taskResponse.status).toBe(201);
        expect(taskResponse.body.uid).toBeDefined();

        const response = await agent.post(
            `/api/task/${taskResponse.body.uid}/delegation-plan`
        );

        expect(response.status).toBe(200);
        expect(response.body.summary).toBeTruthy();
        expect(response.body.delegation_brief).toBeTruthy();
        expect(Array.isArray(response.body.context)).toBe(true);
        expect(response.body.context.length).toBeGreaterThan(0);
        expect(Array.isArray(response.body.subtasks)).toBe(true);
        expect(response.body.subtasks.length).toBeGreaterThan(0);
        expect(response.body.subtasks[0]).toHaveProperty('name');
    });

    it('requires authentication', async () => {
        const response = await request(app).post(
            '/api/task/nonexistent-task/delegation-plan'
        );

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication required');
    });
});
