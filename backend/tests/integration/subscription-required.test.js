const request = require('supertest');
const app = require('../../app');
const { getConfig } = require('../../config/config');
const { BillingAccount, Role, User } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

// TUDUDI_REQUIRE_SUBSCRIPTION turns the instance into one that sells access
// rather than upgrades: without a subscription the app is closed, and only
// billing, the profile and data export answer.
describe('Instances that require a subscription', () => {
    let user, agent;

    beforeEach(async () => {
        config.hosted.enabled = true;
        config.hosted.requireSubscription = true;
        config.hosted.trialDays = 0;
        entitlements.invalidate();
        user = await createTestUser({ email: `sub_${Date.now()}@example.com` });
        agent = await login(user);
    });

    afterEach(async () => {
        config.hosted.enabled = false;
        config.hosted.requireSubscription = false;
        config.hosted.trialDays = 14;
        entitlements.invalidate();
    });

    it('closes the app for an account with no subscription', async () => {
        const tasks = await agent.get('/api/tasks');
        expect(tasks.status).toBe(402);
        expect(tasks.body.code).toBe('SUBSCRIPTION_REQUIRED');

        const create = await agent.post('/api/task').send({ name: 'Nope' });
        expect(create.status).toBe(402);
        expect(create.body.code).toBe('SUBSCRIPTION_REQUIRED');

        for (const path of ['/api/projects', '/api/notes', '/api/areas']) {
            const res = await agent.get(path);
            expect(res.status).toBe(402);
        }
    });

    it('leaves buying, the profile and the export open', async () => {
        const billing = await agent.get('/api/billing');
        expect(billing.status).toBe(200);
        expect(billing.body.subscription_required).toBe(true);
        expect(billing.body.active).toBe(false);

        const profile = await agent.get('/api/profile');
        expect(profile.status).toBe(200);

        // Whatever the backups feature flag says, the gate must not be
        // what stops an export: the answer is never 402.
        const exported = await agent.post('/api/backup/export');
        expect(exported.status).not.toBe(402);
        const list = await agent.get('/api/backup/list');
        expect(list.status).not.toBe(402);
    });

    it('opens the app once a subscription is active, and closes it again when it ends', async () => {
        const account = await BillingAccount.create({
            user_id: user.id,
            status: 'active',
            plan: 'pro',
        });
        entitlements.invalidate();
        const open = await agent.get('/api/tasks');
        expect(open.status).toBe(200);

        await account.update({ status: 'canceled', plan: 'free' });
        entitlements.invalidate();
        const closed = await agent.get('/api/tasks');
        expect(closed.status).toBe(402);
    });

    it('opens the app for a trial, an admin override and an admin', async () => {
        const account = await entitlements.ensureAccount(user.id);

        await account.update({
            trial_ends_at: new Date(Date.now() + 86400000),
        });
        entitlements.invalidate();
        expect((await agent.get('/api/tasks')).status).toBe(200);

        await account.update({ trial_ends_at: null, override_plan: 'pro' });
        entitlements.invalidate();
        expect((await agent.get('/api/tasks')).status).toBe(200);

        await account.update({ override_plan: null });
        await Role.update({ is_admin: true }, { where: { user_id: user.id } });
        entitlements.invalidate();
        expect((await agent.get('/api/tasks')).status).toBe(200);
    });

    it('changes nothing when the flag is off', async () => {
        config.hosted.requireSubscription = false;
        entitlements.invalidate();
        const res = await agent.get('/api/tasks');
        expect(res.status).toBe(200);
        const billing = await agent.get('/api/billing');
        expect(billing.body.subscription_required).toBe(false);
    });

    it('changes nothing on a self-hosted instance', async () => {
        config.hosted.enabled = false;
        entitlements.invalidate();
        const res = await agent.get('/api/tasks');
        expect(res.status).toBe(200);
    });

    afterAll(async () => {
        await User.destroy({ where: {}, force: true });
    });
});
