const request = require('supertest');
const app = require('../../app');
const { User, Role, Setting } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

async function makeAdminDirect(userId) {
    await Role.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, is_admin: true },
    });
}

describe('Admin Registration Toggle', () => {
    let adminUser;
    let adminAgent;

    beforeEach(async () => {
        // Create base user and elevate to admin
        adminUser = await createTestUser({ email: 'admin@example.com' });
        adminAgent = await loginAgent('admin@example.com');
        // Ensure roles table clean for this worker between tests in this suite
        await Role.destroy({ where: {} });
        await makeAdminDirect(adminUser.id);

        // Reset registration setting to false for each test
        await Setting.upsert({
            key: 'registration_enabled',
            value: 'false',
        });
    });

    it('should get current registration status', async () => {
        const res = await request(app)
            .get('/api/registration-status')
            .expect(200);

        expect(res.body).toHaveProperty('enabled');
        expect(typeof res.body.enabled).toBe('boolean');
    });

    it('should allow admin to toggle registration on', async () => {
        const res = await adminAgent
            .post('/api/admin/toggle-registration')
            .send({ enabled: true })
            .expect(200);

        expect(res.body.enabled).toBe(true);

        // Verify the change
        const statusRes = await request(app)
            .get('/api/registration-status')
            .expect(200);

        expect(statusRes.body.enabled).toBe(true);
    });

    it('should allow admin to toggle registration off', async () => {
        const res = await adminAgent
            .post('/api/admin/toggle-registration')
            .send({ enabled: false })
            .expect(200);

        expect(res.body.enabled).toBe(false);

        // Verify the change
        const statusRes = await request(app)
            .get('/api/registration-status')
            .expect(200);

        expect(statusRes.body.enabled).toBe(false);
    });

    it('should reject non-admin users from toggling registration', async () => {
        // Create a regular user
        const regularUser = await createTestUser({
            email: 'regular@example.com',
        });
        const regularAgent = await loginAgent('regular@example.com');

        // Try to toggle registration
        const res = await regularAgent
            .post('/api/admin/toggle-registration')
            .send({ enabled: true });

        expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
        const res = await request(app)
            .post('/api/admin/toggle-registration')
            .send({ enabled: true });

        expect(res.status).toBe(401);
    });

    it('should reject invalid enabled value', async () => {
        const res = await adminAgent
            .post('/api/admin/toggle-registration')
            .send({ enabled: 'invalid' });

        expect(res.status).toBe(400);
    });
});
