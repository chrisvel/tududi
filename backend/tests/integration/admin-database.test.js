const request = require('supertest');
const app = require('../../app');
const { Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('GET /api/admin/database', () => {
    it('tells an admin which database the instance uses', async () => {
        const admin = await createTestUser({
            email: `db-admin_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });

        const res = await (await login(admin)).get('/api/admin/database');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ dialect: 'sqlite' });
    });

    it('is refused to anyone who is not an admin', async () => {
        const admin = await createTestUser({
            email: `db-first_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        const user = await createTestUser({
            email: `db-user_${Date.now()}@example.com`,
        });
        await Role.update(
            { is_admin: false, role: 'user' },
            { where: { user_id: user.id } }
        );

        const res = await (await login(user)).get('/api/admin/database');

        expect(res.status).toBe(403);
        expect((await request(app).get('/api/admin/database')).status).toBe(
            401
        );
    });
});
