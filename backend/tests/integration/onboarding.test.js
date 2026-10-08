const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Onboarding', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `newcomer_${Date.now()}@example.com`,
        });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it('tells the app a new account has not been onboarded', async () => {
        const res = await agent.get('/api/current_user');

        expect(res.status).toBe(200);
        expect(res.body.user.onboarded_at).toBeNull();
    });

    it('marks the welcome screen done once and keeps the first time', async () => {
        const first = await agent.post('/api/onboarding/complete');
        expect(first.status).toBe(200);
        expect(first.body.onboarded_at).toBeTruthy();

        const second = await agent.post('/api/onboarding/complete');
        expect(second.status).toBe(200);
        expect(second.body.onboarded_at).toBe(first.body.onboarded_at);

        const me = await agent.get('/api/current_user');
        expect(me.body.user.onboarded_at).toBe(first.body.onboarded_at);

        const row = await User.findByPk(user.id);
        expect(row.onboarded_at).not.toBeNull();
    });

    it('requires a session', async () => {
        const res = await request(app).post('/api/onboarding/complete');
        expect(res.status).toBe(401);
    });
});
