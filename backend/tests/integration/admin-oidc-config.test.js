const request = require('supertest');
const app = require('../../app');
const { Role, Setting } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const providerConfig = require('../../modules/oidc/providerConfig');

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

const validPayload = () => ({
    enabled: true,
    providers: [
        {
            slug: 'google',
            name: 'Google',
            issuer: 'https://accounts.google.com',
            clientId: 'client-id',
            clientSecret: 'super-secret',
            scope: 'openid profile email',
            autoProvision: true,
            adminEmailDomains: [],
        },
    ],
});

describe('Admin OIDC Config API', () => {
    let adminUser, adminAgent, originalEnv;

    beforeEach(async () => {
        originalEnv = { ...process.env };
        process.env.TUDUDI_SESSION_SECRET = 'x'.repeat(64);

        await Role.destroy({ where: {} });
        await Setting.destroy({ where: { key: 'oidc_config' } });
        providerConfig.reloadProviders();

        adminUser = await createTestUser({ email: 'admin@example.com' });
        adminAgent = await loginAgent('admin@example.com');
        await makeAdminDirect(adminUser.id);
    });

    afterEach(async () => {
        process.env = originalEnv;
        await Setting.destroy({ where: { key: 'oidc_config' } });
        providerConfig.reloadProviders();
    });

    describe('Authentication and authorization', () => {
        it('requires authentication on GET', async () => {
            const res = await request(app).get('/api/admin/oidc-config');
            expect(res.status).toBe(401);
        });

        it('requires authentication on PUT', async () => {
            const res = await request(app)
                .put('/api/admin/oidc-config')
                .send(validPayload());
            expect(res.status).toBe(401);
        });

        it('forbids non-admin users on GET', async () => {
            await createTestUser({ email: 'user@example.com' });
            const agent = await loginAgent('user@example.com');
            const res = await agent.get('/api/admin/oidc-config');
            expect(res.status).toBe(403);
        });

        it('forbids non-admin users on PUT', async () => {
            await createTestUser({ email: 'user2@example.com' });
            const agent = await loginAgent('user2@example.com');
            const res = await agent
                .put('/api/admin/oidc-config')
                .send(validPayload());
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/admin/oidc-config', () => {
        it('returns the env-derived config with source "env" when nothing is saved', async () => {
            const res = await adminAgent.get('/api/admin/oidc-config');
            expect(res.status).toBe(200);
            expect(res.body.source).toBe('env');
        });
    });

    describe('PUT /api/admin/oidc-config', () => {
        it('persists a valid config and returns it masked', async () => {
            const res = await adminAgent
                .put('/api/admin/oidc-config')
                .send(validPayload());

            expect(res.status).toBe(200);
            expect(res.body.source).toBe('db');
            expect(res.body.providers).toHaveLength(1);
            expect(res.body.providers[0].client_secret_set).toBe(true);
            expect(JSON.stringify(res.body)).not.toContain('super-secret');

            const getRes = await adminAgent.get('/api/admin/oidc-config');
            expect(getRes.status).toBe(200);
            expect(getRes.body.source).toBe('db');
            expect(getRes.body.providers[0].slug).toBe('google');
        });

        it('preserves the existing secret when a later PUT omits clientSecret', async () => {
            await adminAgent.put('/api/admin/oidc-config').send(validPayload());

            const payload = validPayload();
            delete payload.providers[0].clientSecret;
            payload.providers[0].name = 'Google Workspace';

            const res = await adminAgent
                .put('/api/admin/oidc-config')
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body.providers[0].name).toBe('Google Workspace');
            const before = (await adminAgent.get('/api/admin/oidc-config')).body
                .providers[0].client_secret_last4;
            expect(before).toBeTruthy();
        });

        it('rejects a malformed provider entry with 400', async () => {
            const payload = validPayload();
            delete payload.providers[0].issuer;

            const res = await adminAgent
                .put('/api/admin/oidc-config')
                .send(payload);

            expect(res.status).toBe(400);
        });

        it('rejects a missing enabled flag with 400', async () => {
            const res = await adminAgent
                .put('/api/admin/oidc-config')
                .send({ providers: [] });

            expect(res.status).toBe(400);
        });
    });
});
