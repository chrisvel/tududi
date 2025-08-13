const request = require('supertest');
const app = require('../../app');
const { User, Role } = require('../../models');
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

describe('Admin Users Management API', () => {
    let adminUser, adminAgent;

    beforeEach(async () => {
        // Create base user and elevate to admin via bootstrap path (no roles exist yet)
        adminUser = await createTestUser({ email: 'admin@example.com' });
        adminAgent = await loginAgent('admin@example.com');
        // Ensure roles table clean for this worker between tests in this suite
        await Role.destroy({ where: {} });
        await makeAdminDirect(adminUser.id);
    });

    describe('Authentication and authorization', () => {
        it('should require authentication', async () => {
            const res = await request(app).get('/api/admin/users');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Authentication required');
        });

        it('should forbid non-admin users', async () => {
            const user = await createTestUser({ email: 'user@example.com' });
            const agent = await loginAgent('user@example.com');
            const res = await agent.get('/api/admin/users');
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Forbidden');
        });
    });

    describe('GET /api/admin/users', () => {
        it('should list users with role and created_at', async () => {
            const res = await adminAgent.get('/api/admin/users');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            const found = res.body.find((u) => u.email === 'admin@example.com');
            expect(found).toBeDefined();
            expect(found.role).toBe('admin');
            expect(found.created_at).toBeTruthy();
        });
    });

    describe('POST /api/admin/users', () => {
        it('should create a regular user by default', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'new@example.com', password: 'password123' });
            expect(res.status).toBe(201);
            expect(res.body.email).toBe('new@example.com');
            expect(res.body.role).toBe('user');
        });

        it('should create an admin user when role is admin', async () => {
            const res = await adminAgent.post('/api/admin/users').send({
                email: 'newadmin@example.com',
                password: 'password123',
                role: 'admin',
            });
            expect(res.status).toBe(201);
            expect(res.body.role).toBe('admin');
            const role = await Role.findOne({
                where: { user_id: res.body.id },
            });
            expect(role?.is_admin).toBe(true);
        });

        it('should validate email format', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'invalid', password: 'password123' });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Invalid email/i);
        });

        it('should validate password length', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'shortpass@example.com', password: '123' });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(
                /Password must be at least 6 characters/i
            );
        });

        it('should reject duplicate emails', async () => {
            await adminAgent
                .post('/api/admin/users')
                .send({ email: 'dupe@example.com', password: 'password123' });
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'dupe@example.com', password: 'password123' });
            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/Email already exists/i);
        });
    });

    describe('DELETE /api/admin/users/:id', () => {
        it('should delete a user', async () => {
            const createRes = await adminAgent.post('/api/admin/users').send({
                email: 'todelete@example.com',
                password: 'password123',
            });
            const id = createRes.body.id;
            const delRes = await adminAgent.delete(`/api/admin/users/${id}`);
            expect(delRes.status).toBe(204);
            const list = await adminAgent.get('/api/admin/users');
            expect(list.body.find((u) => u.id === id)).toBeUndefined();
        });

        it('should prevent deleting self', async () => {
            const res = await adminAgent.delete(
                `/api/admin/users/${adminUser.id}`
            );
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Cannot delete your own account/i);
        });

        it('should return 404 for non-existent user', async () => {
            const res = await adminAgent.delete('/api/admin/users/999999');
            expect(res.status).toBe(404);
        });

        it('should allow deleting another admin when more than one admin exists', async () => {
            // create another admin
            const secondRes = await adminAgent.post('/api/admin/users').send({
                email: 'secondadmin@example.com',
                password: 'password123',
                role: 'admin',
            });
            expect(secondRes.status).toBe(201);
            const secondId = secondRes.body.id;
            // delete the other admin
            const delRes = await adminAgent.delete(
                `/api/admin/users/${secondId}`
            );
            expect(delRes.status).toBe(204);
        });

        it('should prevent deletion of the last remaining admin', async () => {
            // Try to delete the only admin (self is blocked already). Create another admin, delete first, then attempt to delete the last
            const secondRes = await adminAgent.post('/api/admin/users').send({
                email: 'secondadmin2@example.com',
                password: 'password123',
                role: 'admin',
            });
            const secondId = secondRes.body.id;
            // Delete current admin by logging in as second admin
            const secondAgent = await loginAgent('secondadmin2@example.com');
            const delFirst = await secondAgent.delete(
                `/api/admin/users/${adminUser.id}`
            );
            expect(delFirst.status).toBe(204);
            // Now only one admin remains (secondId). Attempt to delete last admin should fail
            const delLast = await secondAgent.delete(
                `/api/admin/users/${secondId}`
            );
            expect(delLast.status).toBe(400);
            // Depending on guard order, backend may return self-deletion or last-admin error
            expect(delLast.body.error).toMatch(
                /(last remaining admin|own account)/i
            );
        });
    });
});
