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
const {
    Role,
    User,
    Project,
    Note,
    Task,
    BillingAccount,
    sequelize,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

// On tududi Cloud the instance admin (the superadmin) and the customers who
// administer their own account must never meet: an account owner manages its
// own account (Access: users, roles, groups) and nothing else. These tests pin
// that down from the owner's side, for every superadmin route and for the
// superadmin's own data. cloud-accounts.test.js covers the account pages.

const config = getConfig();

// Lemon Squeezy is never reached in these tests except to add a seat.
const realFetch = global.fetch;
const mockFetch = async (url, init = {}) => {
    const match = String(url).match(/\/subscription-items\/([^/]+)$/);
    if (match && init.method === 'PATCH') {
        const { quantity } = JSON.parse(init.body).data.attributes;
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

const login = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

const subscribe = (userId) =>
    BillingAccount.create({
        user_id: userId,
        provider: 'lemonsqueezy',
        provider_subscription_id: `sub_${userId}`,
        provider_subscription_item_id: `item_${userId}`,
        seat_quantity: 1,
        status: 'active',
        plan: 'pro',
    });

// The Access routes an account admin may use, scoped to its own account.
// A member who is not an admin is refused them.
const ACCOUNT_ROUTES = [
    ['get', '/api/admin/users'],
    ['post', '/api/admin/users'],
    ['put', '/api/admin/users/1'],
    ['delete', '/api/admin/users/1'],
    ['get', '/api/admin/roles'],
    ['get', '/api/admin/groups'],
    ['post', '/api/admin/groups'],
    ['get', '/api/admin/groups/abc'],
    ['patch', '/api/admin/groups/abc'],
    ['delete', '/api/admin/groups/abc'],
    ['post', '/api/admin/groups/abc/members'],
];

// Every superadmin route, with placeholder ids. None of them may answer an
// owner with anything but a refusal.
const SUPERADMIN_ROUTES = [
    ['get', '/api/admin/overview'],
    ['post', '/api/admin/set-admin-role'],
    ['post', '/api/admin/toggle-registration'],
    ['get', '/api/admin/oidc-config'],
    ['put', '/api/admin/oidc-config'],
    ['get', '/api/admin/waitlist'],
    ['get', '/api/admin/waitlist/export'],
    ['delete', '/api/admin/waitlist/1'],
    ['get', '/api/admin/feedback'],
    ['patch', '/api/admin/feedback/1'],
    ['delete', '/api/admin/feedback/1'],
    ['get', '/api/admin/ai-usage'],
    ['get', '/api/admin/billing'],
    ['get', '/api/admin/billing/1'],
    ['put', '/api/admin/billing/1/override'],
    ['delete', '/api/admin/billing/1/override'],
    ['post', '/api/admin/billing/1/sync'],
];

describe('Cloud: workspace owners never see what the superadmin sees', () => {
    let superadmin, owner, otherOwner, member;
    let superAgent, ownerAgent, memberAgent;
    let secretProject, secretNote, secretTask;

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

        const stamp = Date.now();
        superadmin = await createTestUser({
            email: `super_${stamp}@example.com`,
            name: 'Super',
        });
        owner = await createTestUser({
            email: `owner_${stamp}@example.com`,
            name: 'Owner',
        });
        otherOwner = await createTestUser({
            email: `other_${stamp}@example.com`,
            name: 'Other',
        });
        await Role.destroy({ where: {} });
        await Role.create({ user_id: superadmin.id, is_admin: true });
        await subscribe(owner.id);
        await subscribe(otherOwner.id);

        secretProject = await Project.create({
            name: 'Superadmin secret project',
            user_id: superadmin.id,
        });
        secretNote = await Note.create({
            title: 'Superadmin secret note',
            content: 'superadmin-only',
            user_id: superadmin.id,
        });
        secretTask = await Task.create({
            name: 'Superadmin secret task',
            user_id: superadmin.id,
            project_id: secretProject.id,
        });

        superAgent = await login(superadmin.email);
        ownerAgent = await login(owner.email);

        const added = await ownerAgent.post('/api/members').send({
            name: 'Maria',
            email: `maria_${stamp}@example.com`,
            password: 'password123',
        });
        if (added.status !== 201) {
            throw new Error(`could not add a member: ${added.status}`);
        }
        member = added.body;
        memberAgent = await login(member.email);
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
        plans._resetCache();
        entitlements.invalidate();
    });

    describe('the owner is an account admin, not an instance admin', () => {
        it('is told it is an admin of its account only', async () => {
            const res = await ownerAgent.get('/api/current_user');
            expect(res.body.user.is_admin).toBe(false);
            expect(res.body.user.role).toBe('account_admin');
            expect(res.body.user.capabilities.invite_members).toBe(true);
        });

        it.each(SUPERADMIN_ROUTES)('is refused %s %s', async (method, path) => {
            const res = await ownerAgent[method](path).send({});
            expect([401, 403, 404]).toContain(res.status);
        });

        it.each([...SUPERADMIN_ROUTES, ...ACCOUNT_ROUTES])(
            'refuses %s %s to a member who is not an admin',
            async (method, path) => {
                const res = await memberAgent[method](path).send({});
                expect([401, 403, 404]).toContain(res.status);
            }
        );

        it('cannot make itself or a member the superadmin', async () => {
            const asAdmin = await ownerAgent
                .post('/api/members')
                .send({ name: 'Sneaky', role: 'admin' });
            const promoted = await ownerAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ role: 'admin' });
            const self = await ownerAgent
                .put(`/api/admin/users/${owner.id}`)
                .send({ role: 'admin' });

            expect(asAdmin.status).toBe(403);
            expect(promoted.status).toBe(403);
            expect(self.status).toBe(403);
            expect(await User.count({ where: { name: 'Sneaky' } })).toBe(0);
            expect(await Role.count({ where: { is_admin: true } })).toBe(1);
        });

        it('cannot reach the superadmin through the Access page', async () => {
            const update = await ownerAgent
                .put(`/api/admin/users/${superadmin.id}`)
                .send({ name: 'Hijacked' });
            const remove = await ownerAgent.delete(
                `/api/admin/users/${superadmin.id}`
            );
            const list = await ownerAgent.get('/api/admin/users');

            expect(update.status).toBe(404);
            expect(remove.status).toBe(404);
            expect(list.status).toBe(200);
            expect(JSON.stringify(list.body)).not.toContain(superadmin.email);
            expect((await User.findByPk(superadmin.id)).name).toBe('Super');
        });
    });

    describe("the superadmin's account", () => {
        it('cannot be changed, linked or removed by an owner', async () => {
            const patch = await ownerAgent
                .patch(`/api/members/${superadmin.id}`)
                .send({ name: 'Hijacked' });
            const remove = await ownerAgent.delete(
                `/api/members/${superadmin.id}`
            );
            const link = await ownerAgent.post(
                `/api/members/${superadmin.id}/sign-in-link`
            );

            expect(patch.status).toBe(404);
            expect(remove.status).toBe(404);
            expect(link.status).toBe(404);
            const after = await User.findByPk(superadmin.id);
            expect(after.name).toBe('Super');
        });

        it('is not listed to an owner anywhere', async () => {
            const lists = await Promise.all([
                ownerAgent.get('/api/people'),
                ownerAgent.get('/api/shares/candidates'),
                ownerAgent.get('/api/everyone'),
            ]);
            for (const res of lists) {
                expect(res.status).toBe(200);
                const text = JSON.stringify(res.body);
                expect(text).not.toContain(superadmin.email);
                expect(text).not.toContain('Super');
                expect(text).not.toContain(otherOwner.email);
            }
        });

        it("keeps the superadmin's data out of an owner's reach", async () => {
            const reads = await Promise.all([
                ownerAgent.get(`/api/project/${secretProject.uid}`),
                ownerAgent.get(`/api/note/${secretNote.uid}`),
                ownerAgent.get(`/api/task/${secretTask.uid}`),
            ]);
            for (const res of reads) {
                expect([403, 404]).toContain(res.status);
            }

            // A control: the same search does find the owner's own note, so
            // an empty answer below means filtering, not a broken query.
            await Note.create({
                title: 'Owner secret note',
                content: 'owner-only',
                user_id: owner.id,
            });
            const own = await ownerAgent.get('/api/search?q=secret');
            expect(JSON.stringify(own.body)).toContain('Owner secret note');

            const lists = await Promise.all([
                ownerAgent.get('/api/projects'),
                ownerAgent.get('/api/notes'),
                ownerAgent.get('/api/tasks'),
                ownerAgent.get('/api/search?q=secret'),
            ]);
            for (const res of lists) {
                expect(res.status).toBe(200);
                expect(JSON.stringify(res.body)).not.toContain(
                    'Superadmin secret'
                );
            }
        });

        it("keeps the superadmin's data out of a member's reach", async () => {
            const res = await memberAgent.get(
                `/api/project/${secretProject.uid}`
            );
            expect([403, 404]).toContain(res.status);
            const search = await memberAgent.get('/api/search?q=secret');
            expect(JSON.stringify(search.body)).not.toContain(
                'Superadmin secret'
            );
        });
    });

    describe('one workspace and another', () => {
        it("cannot touch another owner's member", async () => {
            const otherAgent = await login(otherOwner.email);

            const patch = await otherAgent
                .patch(`/api/members/${member.id}`)
                .send({ name: 'Hijacked' });
            const remove = await otherAgent.delete(`/api/members/${member.id}`);

            expect(patch.status).toBe(404);
            expect(remove.status).toBe(404);
            expect(await User.findByPk(member.id)).not.toBeNull();
        });
    });

    describe('the superadmin', () => {
        it('still reaches the admin pages', async () => {
            const users = await superAgent.get('/api/admin/users');
            expect(users.status).toBe(200);
            const roles = await superAgent.get('/api/admin/roles');
            expect(roles.status).toBe(200);
        });
    });
});
