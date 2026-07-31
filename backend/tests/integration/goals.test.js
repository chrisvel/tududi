const request = require('supertest');
const app = require('../../app');
const { Goal, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Goals Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'goaltest@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'goaltest@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/goals', () => {
        it('should create a goal with a color', async () => {
            const response = await agent.post('/api/goals').send({
                title: 'Run a marathon',
                horizon: 'year',
                status: 'active',
                color: '#1d4ed8',
            });

            expect(response.status).toBe(201);
            expect(response.body.goal.color).toBe('#1d4ed8');
        });

        it('should create a goal without a color', async () => {
            const response = await agent.post('/api/goals').send({
                title: 'Read more books',
                horizon: 'season',
                status: 'active',
            });

            expect(response.status).toBe(201);
            expect(response.body.goal.color).toBeNull();
        });
    });

    describe('PATCH /api/goals/:uid', () => {
        it('should update a goal color', async () => {
            const created = await agent.post('/api/goals').send({
                title: 'Learn guitar',
                horizon: 'year',
                status: 'active',
            });
            const uid = created.body.goal.uid;

            const response = await agent.patch(`/api/goals/${uid}`).send({
                color: '#15803d',
            });

            expect(response.status).toBe(200);
            expect(response.body.goal.color).toBe('#15803d');
        });

        it('should clear a goal color when set to null', async () => {
            const created = await agent.post('/api/goals').send({
                title: 'Learn piano',
                horizon: 'year',
                status: 'active',
                color: '#b91c1c',
            });
            const uid = created.body.goal.uid;

            const response = await agent.patch(`/api/goals/${uid}`).send({
                color: null,
            });

            expect(response.status).toBe(200);
            expect(response.body.goal.color).toBeNull();
        });
    });
});
