const request = require('supertest');
const app = require('../../app');
const { User, Role } = require('../../models');
const { getConfig } = require('../../config/config');
const { createTestUser } = require('../helpers/testUtils');

// Hosted mode is a config flag read at call time, so it can be flipped on
// the live config object for these tests only.
describe('Hosted mode: admin bootstrap is never implicit', () => {
    const config = getConfig();

    beforeEach(async () => {
        await Role.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
        config.hosted.enabled = true;
    });

    afterEach(() => {
        config.hosted.enabled = false;
    });

    it('does not make the first user admin', async () => {
        const first = await createTestUser({
            email: `first_${Date.now()}@example.com`,
        });

        const role = await Role.findOne({ where: { user_id: first.id } });
        expect(role).not.toBeNull();
        expect(role.is_admin).toBe(false);
    });

    it('refuses bootstrap role assignment even when no roles exist', async () => {
        const user = await createTestUser({
            email: `claimant_${Date.now()}@example.com`,
        });
        await Role.destroy({ where: {}, force: true });

        const agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });

        const res = await agent
            .post('/api/admin/set-admin-role')
            .send({ user_id: user.id, is_admin: true });

        expect(res.status).toBe(403);
        const roles = await Role.count({ where: { is_admin: true } });
        expect(roles).toBe(0);
    });

    it('still lets an explicit admin manage roles', async () => {
        const admin = await createTestUser({
            email: `admin_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        const other = await createTestUser({
            email: `other_${Date.now()}@example.com`,
        });

        const agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: admin.email, password: 'password123' });

        const res = await agent
            .post('/api/admin/set-admin-role')
            .send({ user_id: other.id, is_admin: true });

        expect(res.status).toBe(200);
        const role = await Role.findOne({ where: { user_id: other.id } });
        expect(role.is_admin).toBe(true);
    });
});

describe('Self-hosted (default): first user is the owner', () => {
    beforeEach(async () => {
        await Role.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
    });

    it('makes the first user admin when hosted mode is off', async () => {
        const first = await createTestUser({
            email: `owner_${Date.now()}@example.com`,
        });

        const role = await Role.findOne({ where: { user_id: first.id } });
        expect(role.is_admin).toBe(true);
    });
});
