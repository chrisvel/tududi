const { getConfig } = require('../../../config/config');
const plans = require('../../../config/plans');
const { resolvePlan } = require('../../../services/entitlementsService');

const config = getConfig();
const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-06T12:00:00Z');
const inDays = (d) => new Date(now.getTime() + d * DAY);

describe('plans catalog', () => {
    afterEach(() => {
        delete process.env.TUDUDI_PLANS_JSON;
        plans._resetCache();
    });

    it('ships a free and a pro plan with every limit and feature key', () => {
        const all = plans.getPlans();
        expect(Object.keys(all)).toEqual(['free', 'pro']);
        for (const key of plans.LIMIT_KEYS) {
            expect(all.free.limits).toHaveProperty(key);
            expect(all.pro.limits).toHaveProperty(key);
        }
        for (const key of plans.FEATURE_KEYS) {
            expect(typeof all.free.features[key]).toBe('boolean');
        }
        expect(all.pro.limits.max_tasks).toBeNull();
    });

    it('deep-merges TUDUDI_PLANS_JSON over the defaults', () => {
        process.env.TUDUDI_PLANS_JSON = JSON.stringify({
            free: { limits: { max_tasks: 5 }, features: { ai: true } },
            team: { name: 'Team', limits: { max_tasks: 9000 } },
        });
        plans._resetCache();

        const all = plans.getPlans();
        expect(all.free.limits.max_tasks).toBe(5);
        expect(all.free.limits.max_projects).toBe(10);
        expect(all.free.features.ai).toBe(true);
        expect(all.free.features.mcp).toBe(false);
        expect(all.team.name).toBe('Team');
        expect(all.team.limits.max_projects).toBeNull();
    });

    it('falls back to the defaults on invalid JSON', () => {
        process.env.TUDUDI_PLANS_JSON = '{not json';
        plans._resetCache();
        expect(plans.getPlans().free.limits.max_tasks).toBe(200);
    });
});

describe('resolvePlan', () => {
    beforeEach(() => {
        config.hosted.enabled = true;
        config.hosted.graceDays = 14;
        config.hosted.exemptAdmins = true;
        plans._resetCache();
    });

    afterEach(() => {
        config.hosted.enabled = false;
    });

    const resolve = (account, opts = {}) =>
        resolvePlan(account, null, { now, ...opts });

    it('is unlimited when hosted mode is off, whatever the account says', () => {
        config.hosted.enabled = false;
        const r = resolve({ status: 'canceled' });
        expect(r.plan.key).toBe('unlimited');
        expect(r.reason).toBe('hosted_off');
    });

    it('gives a user with no account row the free plan', () => {
        const r = resolve(null);
        expect(r.plan.key).toBe('free');
        expect(r.reason).toBe('free');
    });

    it('treats a running local trial as pro and an expired one as free', () => {
        expect(
            resolve({ status: 'none', trial_ends_at: inDays(3) })
        ).toMatchObject({
            reason: 'trial',
        });
        expect(
            resolve({ status: 'none', trial_ends_at: inDays(-1) })
        ).toMatchObject({
            reason: 'free',
        });
    });

    it('honours active and trialing subscriptions', () => {
        expect(resolve({ status: 'active', plan: 'pro' }).plan.key).toBe('pro');
        expect(resolve({ status: 'trialing', plan: 'pro' }).reason).toBe(
            'subscription'
        );
    });

    it('keeps pro during the past_due grace window, then drops to free', () => {
        const inside = resolve({
            status: 'past_due',
            plan: 'pro',
            current_period_end: inDays(-3),
        });
        expect(inside.reason).toBe('grace');
        expect(inside.plan.key).toBe('pro');

        const outside = resolve({
            status: 'past_due',
            plan: 'pro',
            current_period_end: inDays(-20),
        });
        expect(outside.reason).toBe('free');
    });

    it('drops canceled, unpaid and expired subscriptions to free', () => {
        for (const status of [
            'canceled',
            'unpaid',
            'incomplete_expired',
            'paused',
        ]) {
            expect(resolve({ status, plan: 'pro' }).plan.key).toBe('free');
        }
    });

    it('applies a valid admin override and ignores an expired one', () => {
        expect(
            resolve({ status: 'canceled', override_plan: 'pro' }).reason
        ).toBe('override');
        expect(
            resolve({
                status: 'canceled',
                override_plan: 'pro',
                override_expires_at: inDays(30),
            }).plan.key
        ).toBe('pro');
        expect(
            resolve({
                status: 'canceled',
                override_plan: 'pro',
                override_expires_at: inDays(-1),
            }).plan.key
        ).toBe('free');
        expect(
            resolve({ status: 'active', plan: 'pro', override_plan: 'free' })
                .plan.key
        ).toBe('free');
    });

    it('exempts admins unless told otherwise', () => {
        expect(resolve({ status: 'canceled' }, { isAdmin: true }).reason).toBe(
            'admin'
        );
        config.hosted.exemptAdmins = false;
        expect(
            resolve({ status: 'canceled' }, { isAdmin: true }).plan.key
        ).toBe('free');
    });
});
