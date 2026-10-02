const request = require('supertest');

jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async () => ({ success: true, messageId: 'test' }),
}));

const app = require('../../app');
const { getConfig } = require('../../config/config');
const plans = require('../../config/plans');
const { User, BillingAccount, sequelize } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const rolesService = require('../../services/rolesService');
const { createTestUser } = require('../helpers/testUtils');

// Lemon Squeezy is reached over plain fetch; only the subscription item
// endpoint matters here. `ls.fail` makes it answer 500.
const ls = { patches: [], fail: false };
const realFetch = global.fetch;
const mockFetch = async (url, init = {}) => {
    const path = String(url).replace('https://api.lemonsqueezy.com/v1', '');
    const match = path.match(/^\/subscription-items\/([^/]+)$/);
    if (match && init.method === 'PATCH') {
        if (ls.fail) {
            return new Response('boom', { status: 500 });
        }
        const body = JSON.parse(init.body);
        const quantity = body.data.attributes.quantity;
        ls.patches.push({ id: match[1], quantity });
        return new Response(
            JSON.stringify({
                data: {
                    type: 'subscription-items',
                    id: match[1],
                    attributes: { quantity },
                },
            }),
            { status: 200 }
        );
    }
    return new Response('not found', { status: 404 });
};

const config = getConfig();

const login = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

const subscribe = (userId, fields = {}) =>
    BillingAccount.create({
        user_id: userId,
        provider: 'lemonsqueezy',
        provider_subscription_id: `sub_${userId}`,
        provider_subscription_item_id: `item_${userId}`,
        seat_quantity: 1,
        status: 'active',
        plan: 'pro',
        ...fields,
    });

describe('Cloud seats', () => {
    let owner;
    let ownerAgent;

    beforeAll(() => {
        global.fetch = mockFetch;
    });

    afterAll(async () => {
        global.fetch = realFetch;
        await sequelize.close();
    });

    beforeEach(async () => {
        config.hosted.enabled = true;
        config.hosted.trialDays = 0;
        config.hosted.requireSubscription = true;
        config.hosted.billing.provider = 'lemonsqueezy';
        config.hosted.lemonsqueezy.apiKey = 'ls_test_key';
        config.hosted.lemonsqueezy.storeId = '1';
        config.hosted.lemonsqueezy.webhookSecret = 'secret';
        config.hosted.lemonsqueezy.variants.proMonthly = '100';
        plans._resetCache();
        entitlements.invalidate();
        ls.patches = [];
        ls.fail = false;

        owner = await createTestUser({
            email: `owner_${Date.now()}@example.com`,
            name: 'Alex',
        });
        ownerAgent = await login(owner.email);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.trialDays = 14;
        config.hosted.requireSubscription = false;
        config.hosted.billing.provider = 'stripe';
        config.hosted.lemonsqueezy.apiKey = undefined;
        config.hosted.lemonsqueezy.storeId = undefined;
        config.hosted.lemonsqueezy.webhookSecret = undefined;
        config.hosted.lemonsqueezy.variants.proMonthly = undefined;
        delete process.env.TUDUDI_PLANS_JSON;
        plans._resetCache();
        entitlements.invalidate();
    });

    const addMember = (agent, body) => agent.post('/api/members').send(body);

    describe('who owns a workspace', () => {
        it('lets an account that signed up by itself add members', async () => {
            expect(await rolesService.can(owner.id, 'invite_members')).toBe(
                true
            );
        });

        it('does not let a member add members of its own', async () => {
            const member = await createTestUser({
                email: `m_${Date.now()}@example.com`,
                created_by_user_id: owner.id,
            });
            expect(await rolesService.can(member.id, 'invite_members')).toBe(
                false
            );
        });

        it('keeps the role defaults on a self-hosted instance', async () => {
            config.hosted.enabled = false;
            expect(await rolesService.can(owner.id, 'invite_members')).toBe(
                false
            );
        });
    });

    describe('adding a member', () => {
        it('adds a paid seat and covers the member with the owner plan', async () => {
            await subscribe(owner.id);

            const res = await addMember(ownerAgent, {
                name: 'Maria',
                email: `maria_${Date.now()}@example.com`,
                password: 'password123',
            });

            expect(res.status).toBe(201);
            expect(ls.patches).toEqual([
                { id: `item_${owner.id}`, quantity: 2 },
            ]);
            const account = await BillingAccount.findOne({
                where: { user_id: owner.id },
            });
            expect(account.seat_quantity).toBe(2);

            const ent = await entitlements.getEntitlements(res.body.id);
            expect(ent.reason).toBe('seat');
            expect(ent.active).toBe(true);
            expect(ent.seat_owner).toEqual({ id: owner.id, name: 'Alex' });

            const memberAgent = await login(res.body.email);
            const tasks = await memberAgent.get('/api/tasks');
            expect(tasks.status).toBe(200);

            const memberBilling = await memberAgent.get('/api/billing');
            expect(memberBilling.body.reason).toBe('seat');
            expect(memberBilling.body.checkout_available).toBe(false);

            const ownerBilling = await ownerAgent.get('/api/billing');
            expect(ownerBilling.body.seats).toEqual({
                members: 1,
                needed: 2,
                billed: 2,
            });
        });

        it('adds a member without an email', async () => {
            await subscribe(owner.id);

            const res = await addMember(ownerAgent, { name: 'Emma' });

            expect(res.status).toBe(201);
            expect(res.body.email).toBeNull();
            expect(ls.patches).toHaveLength(1);
        });

        it('is refused without a subscription and creates nothing', async () => {
            const res = await addMember(ownerAgent, { name: 'Emma' });

            expect(res.status).toBe(402);
            expect(ls.patches).toHaveLength(0);
            expect(await User.count({ where: { name: 'Emma' } })).toBe(0);
        });

        it('creates nothing when the seat cannot be paid for', async () => {
            await subscribe(owner.id);
            ls.fail = true;

            const res = await addMember(ownerAgent, { name: 'Emma' });

            expect(res.status).toBeGreaterThanOrEqual(500);
            expect(await User.count({ where: { name: 'Emma' } })).toBe(0);
        });

        it('stops at the plan member limit', async () => {
            process.env.TUDUDI_PLANS_JSON = JSON.stringify({
                pro: { limits: { max_members: 1 } },
            });
            plans._resetCache();
            entitlements.invalidate();
            await subscribe(owner.id);

            expect((await addMember(ownerAgent, { name: 'Emma' })).status).toBe(
                201
            );
            const res = await addMember(ownerAgent, { name: 'Leo' });

            expect(res.status).toBe(402);
            expect(res.body.code).toBe('PLAN_LIMIT_REACHED');
            expect(await User.count({ where: { name: 'Leo' } })).toBe(0);
        });

        it('is refused for a member', async () => {
            await subscribe(owner.id);
            const added = await addMember(ownerAgent, {
                name: 'Maria',
                email: `maria2_${Date.now()}@example.com`,
                password: 'password123',
            });
            const memberAgent = await login(added.body.email);

            const res = await addMember(memberAgent, { name: 'Leo' });

            expect(res.status).toBe(403);
        });
    });

    describe('managing members', () => {
        let member;

        beforeEach(async () => {
            await subscribe(owner.id);
            const res = await addMember(ownerAgent, { name: 'Emma' });
            member = res.body;
            ls.patches = [];
        });

        it('lets the owner rename a member', async () => {
            const res = await ownerAgent
                .patch(`/api/members/${member.id}`)
                .send({ name: 'Emmy' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Emmy');
        });

        it('gives a member without an email one, and invites them', async () => {
            const res = await ownerAgent
                .patch(`/api/members/${member.id}`)
                .send({ email: `emma_${Date.now()}@example.com` });

            expect(res.status).toBe(200);
            expect(res.body.invited).toBe(true);
        });

        it('does not change an email that is already set', async () => {
            await ownerAgent
                .patch(`/api/members/${member.id}`)
                .send({ email: `first_${Date.now()}@example.com` });

            const res = await ownerAgent
                .patch(`/api/members/${member.id}`)
                .send({ email: `second_${Date.now()}@example.com` });

            expect(res.status).toBe(403);
        });

        it('hides another owner members', async () => {
            const stranger = await createTestUser({
                email: `stranger_${Date.now()}@example.com`,
            });
            await subscribe(stranger.id);
            const strangerAgent = await login(stranger.email);

            const patch = await strangerAgent
                .patch(`/api/members/${member.id}`)
                .send({ name: 'Hacked' });
            const del = await strangerAgent.delete(`/api/members/${member.id}`);

            expect(patch.status).toBe(404);
            expect(del.status).toBe(404);
            expect(await User.findByPk(member.id)).not.toBeNull();
        });

        it('removes a member and gives the seat back', async () => {
            const res = await ownerAgent.delete(`/api/members/${member.id}`);

            expect(res.status).toBe(204);
            expect(await User.findByPk(member.id)).toBeNull();
            expect(ls.patches).toEqual([
                { id: `item_${owner.id}`, quantity: 1 },
            ]);
        });
    });

    describe('when the owner stops paying', () => {
        it('closes the app for the members too', async () => {
            await subscribe(owner.id);
            const added = await addMember(ownerAgent, {
                name: 'Maria',
                email: `maria3_${Date.now()}@example.com`,
                password: 'password123',
            });
            const memberAgent = await login(added.body.email);

            await BillingAccount.update(
                { status: 'canceled', plan: 'free' },
                { where: { user_id: owner.id } }
            );
            entitlements.invalidate();

            const tasks = await memberAgent.get('/api/tasks');
            expect(tasks.status).toBe(402);
            const exported = await memberAgent.get('/api/profile');
            expect(exported.status).toBe(200);
        });
    });
});
