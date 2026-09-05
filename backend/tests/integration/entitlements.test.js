const { getConfig } = require('../../config/config');
const plans = require('../../config/plans');
const {
    Task,
    Project,
    Note,
    Role,
    BillingAccount,
    UsageCounter,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();

describe('entitlementsService with hosted mode off', () => {
    it('answers unlimited without creating a billing row', async () => {
        const user = await createTestUser({
            email: `off_${Date.now()}@example.com`,
        });

        const ent = await entitlements.getEntitlements(user.id);
        expect(ent.hosted).toBe(false);
        expect(ent.limits.max_tasks).toBeNull();
        expect(ent.features.mcp).toBe(true);
        expect(await BillingAccount.count()).toBe(0);

        await expect(
            entitlements.assertCanCreate(user.id, 'task', 10000)
        ).resolves.toBeUndefined();
        await expect(
            entitlements.assertFeature(user.id, 'ai')
        ).resolves.toBeUndefined();
        expect(await entitlements.consumeUsage(user.id, 'ai_requests')).toBe(0);
        expect(await UsageCounter.count()).toBe(0);
    });
});

describe('entitlementsService with hosted mode on', () => {
    let user;

    beforeEach(async () => {
        config.hosted.enabled = true;
        config.hosted.trialDays = 0;
        process.env.TUDUDI_PLANS_JSON = JSON.stringify({
            free: {
                limits: {
                    max_tasks: 2,
                    max_projects: 1,
                    max_notes: 1,
                    storage_mb: 1,
                    ai_requests_per_day: 2,
                },
            },
        });
        plans._resetCache();
        entitlements.invalidate();

        // The first user on an empty instance would be admin (and exempt)
        // on a self-hosted install; hosted mode never promotes implicitly.
        user = await createTestUser({
            email: `on_${Date.now()}@example.com`,
        });
        const role = await Role.findOne({ where: { user_id: user.id } });
        if (role.is_admin) {
            throw new Error('hosted mode must not promote the first user');
        }
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.trialDays = 14;
        delete process.env.TUDUDI_PLANS_JSON;
        plans._resetCache();
        entitlements.invalidate();
    });

    it('creates the billing row lazily and reports the free plan', async () => {
        const ent = await entitlements.getEntitlements(user.id, {
            includeUsage: true,
        });
        expect(ent.hosted).toBe(true);
        expect(ent.plan).toBe('free');
        expect(ent.limits.max_tasks).toBe(2);
        expect(ent.usage).toEqual({
            tasks: 0,
            projects: 0,
            notes: 0,
            storage_bytes: 0,
            ai_requests_today: 0,
        });
        expect(
            await BillingAccount.count({ where: { user_id: user.id } })
        ).toBe(1);
    });

    it('starts a trial from the account creation date when configured', async () => {
        config.hosted.trialDays = 14;
        const ent = await entitlements.getEntitlements(user.id);
        expect(ent.plan).toBe('pro');
        expect(ent.reason).toBe('trial');
        expect(new Date(ent.trial_ends_at).getTime()).toBeGreaterThan(
            Date.now()
        );
    });

    it('stops task creation at the limit, counting only active tasks', async () => {
        await Task.create({ name: 'a', user_id: user.id });
        await Task.create({
            name: 'b',
            user_id: user.id,
            status: Task.STATUS.DONE,
        });
        await expect(
            entitlements.assertCanCreate(user.id, 'task')
        ).resolves.toBeUndefined();

        await Task.create({ name: 'c', user_id: user.id });
        await expect(
            entitlements.assertCanCreate(user.id, 'task')
        ).rejects.toMatchObject({
            statusCode: 402,
            code: 'PLAN_LIMIT_REACHED',
            details: { resource: 'task', limit: 2, current: 2, plan: 'free' },
        });
        await expect(
            entitlements.assertCanCreate(user.id, 'task', 3)
        ).rejects.toThrow();
    });

    it('limits projects and notes the same way', async () => {
        await Project.create({ name: 'p', user_id: user.id });
        await expect(
            entitlements.assertCanCreate(user.id, 'project')
        ).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });

        await Note.create({ title: 'n', content: 'c', user_id: user.id });
        await expect(
            entitlements.assertCanCreate(user.id, 'note')
        ).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    });

    it('enforces the storage quota', async () => {
        await expect(
            entitlements.assertStorage(user.id, 512 * 1024)
        ).resolves.toBeUndefined();
        await expect(
            entitlements.assertStorage(user.id, 2 * 1024 * 1024)
        ).rejects.toMatchObject({
            code: 'PLAN_LIMIT_REACHED',
            details: { resource: 'storage', plan: 'free' },
        });
    });

    it('gates features and counts daily AI usage', async () => {
        await expect(
            entitlements.assertFeature(user.id, 'mcp')
        ).rejects.toMatchObject({
            statusCode: 402,
            code: 'FEATURE_NOT_IN_PLAN',
            details: { feature: 'mcp', plan: 'free' },
        });
        expect(await entitlements.hasFeature(user.id, 'attachments')).toBe(
            true
        );

        expect(await entitlements.consumeUsage(user.id, 'ai_requests')).toBe(1);
        expect(await entitlements.consumeUsage(user.id, 'ai_requests')).toBe(2);
        await expect(
            entitlements.consumeUsage(user.id, 'ai_requests')
        ).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });

        const usage = await entitlements.getUsage(user.id);
        expect(usage.ai_requests_today).toBe(2);
    });

    it('lifts limits through an admin override and drops the cache', async () => {
        await Task.create({ name: 'a', user_id: user.id });
        await Task.create({ name: 'b', user_id: user.id });
        await expect(
            entitlements.assertCanCreate(user.id, 'task')
        ).rejects.toThrow();

        await BillingAccount.update(
            { override_plan: 'pro', override_reason: 'friend' },
            { where: { user_id: user.id } }
        );
        entitlements.invalidate(user.id);

        await expect(
            entitlements.assertCanCreate(user.id, 'task')
        ).resolves.toBeUndefined();
        const ent = await entitlements.getEntitlements(user.id);
        expect(ent.reason).toBe('override');
        expect(ent.override.reason).toBe('friend');
    });

    it('exempts admins', async () => {
        await Role.update({ is_admin: true }, { where: { user_id: user.id } });
        entitlements.invalidate(user.id);
        const ent = await entitlements.getEntitlements(user.id);
        expect(ent.plan).toBe('pro');
        expect(ent.reason).toBe('admin');
    });
});
