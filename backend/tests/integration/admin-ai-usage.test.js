const request = require('supertest');
const app = require('../../app');
const { getConfig } = require('../../config/config');
const { Role, UsageCounter } = require('../../models');
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

function enableHosted() {
    config.hosted.enabled = true;
    config.hosted.trialDays = 0;
    entitlements.invalidate();
}

function disableHosted() {
    config.hosted.enabled = false;
    config.hosted.trialDays = 14;
    entitlements.invalidate();
}

describe('Admin AI usage', () => {
    it('is hidden entirely when hosted mode is off', async () => {
        const admin = await createTestUser({
            email: `off_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        const adminAgent = await login(admin);
        expect((await adminAgent.get('/api/admin/ai-usage')).status).toBe(404);
    });

    describe('hosted mode on', () => {
        let admin, adminAgent, user, agent;

        beforeEach(async () => {
            enableHosted();
            admin = await createTestUser({
                email: `admin_${Date.now()}@example.com`,
            });
            await Role.update(
                { is_admin: true },
                { where: { user_id: admin.id } }
            );
            adminAgent = await login(admin);

            user = await createTestUser({
                email: `member_${Date.now()}@example.com`,
            });
            agent = await login(user);
        });

        afterEach(() => {
            disableHosted();
        });

        it('is refused for a non-admin', async () => {
            expect((await agent.get('/api/admin/ai-usage')).status).toBe(403);
        });

        it('lists every user and an aggregate total, reflecting recorded credit usage', async () => {
            // Seeded directly (rather than via consumeMonthlyUsage) so this
            // test doesn't depend on the free plan's ai_credits_per_month
            // limit - that enforcement path is covered elsewhere.
            await UsageCounter.create({
                user_id: user.id,
                metric: 'ai_credits',
                period_key: entitlements.monthKey(),
                count: 3,
            });

            const response = await adminAgent.get('/api/admin/ai-usage');

            expect(response.status).toBe(200);
            expect(response.body.total).toBeGreaterThanOrEqual(2);
            expect(response.body.summary.total_credits_used_this_month).toBe(3);

            const row = response.body.users.find((u) => u.id === user.id);
            expect(row).toMatchObject({
                email: user.email,
                plan: 'free',
                ai_credits_used_this_month: 3,
            });
        });

        it('filters by email search', async () => {
            const response = await adminAgent.get(
                `/api/admin/ai-usage?q=${encodeURIComponent(user.email)}`
            );

            expect(response.status).toBe(200);
            expect(response.body.users).toHaveLength(1);
            expect(response.body.users[0].email).toBe(user.email);
        });
    });
});
