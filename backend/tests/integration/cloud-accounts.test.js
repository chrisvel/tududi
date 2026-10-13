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
    Account,
    Role,
    User,
    UserGroup,
    Project,
    BillingAccount,
    sequelize,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const accountsService = require('../../services/accountsService');
const { createTestUser } = require('../helpers/testUtils');

// Accounts on tududi Cloud: whoever signs up owns an account and is an admin
// of it; admins manage the members, roles and groups of their own account and
// may make other members admins; the superadmin is the only instance admin.

const config = getConfig();

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

const enableHosted = () => {
    config.hosted.enabled = true;
    config.hosted.billing.provider = 'lemonsqueezy';
    config.hosted.lemonsqueezy.apiKey = 'ls_test_key';
    config.hosted.lemonsqueezy.storeId = '1';
    config.hosted.lemonsqueezy.webhookSecret = 'secret';
    config.hosted.lemonsqueezy.variants.proMonthly = '100';
    plans._resetCache();
    entitlements.invalidate();
};

const disableHosted = () => {
    config.hosted.enabled = false;
    config.hosted.billing.provider = 'stripe';
    config.hosted.lemonsqueezy.apiKey = undefined;
    config.hosted.lemonsqueezy.storeId = undefined;
    config.hosted.lemonsqueezy.webhookSecret = undefined;
    config.hosted.lemonsqueezy.variants.proMonthly = undefined;
    plans._resetCache();
    entitlements.invalidate();
};

describe('Cloud accounts', () => {
    let stamp, superadmin, owner, otherOwner;
    let superAgent, ownerAgent, otherAgent;

    const addMember = async (agent, body) => {
        const res = await agent.post('/api/members').send({
            password: 'password123',
            ...body,
        });
        if (res.status !== 201) {
            throw new Error(
                `could not add a member: ${res.status} ${JSON.stringify(res.body)}`
            );
        }
        return res.body;
    };

    beforeAll(() => {
        global.fetch = mockFetch;
    });

    afterAll(async () => {
        global.fetch = realFetch;
        await sequelize.close();
    });

    beforeEach(async () => {
        enableHosted();
        stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        superadmin = await createTestUser({
            email: `super_${stamp}@example.com`,
            name: 'Super',
        });
        await Role.update({ is_admin: false }, { where: {} });
        await Role.update(
            { is_admin: true, role: 'admin' },
            { where: { user_id: superadmin.id } }
        );
        owner = await createTestUser({
            email: `owner_${stamp}@example.com`,
            name: 'Owner',
        });
        otherOwner = await createTestUser({
            email: `other_${stamp}@example.com`,
            name: 'Other',
        });
        await subscribe(owner.id);
        await subscribe(otherOwner.id);
        superAgent = await login(superadmin.email);
        ownerAgent = await login(owner.email);
        otherAgent = await login(otherOwner.email);
    });

    afterEach(() => {
        disableHosted();
    });

    describe('signing up', () => {
        it('makes the new customer the owner and an admin of an account', async () => {
            const account = await Account.findOne({
                where: { owner_user_id: owner.id },
            });
            expect(account).not.toBeNull();
            expect((await User.findByPk(owner.id)).account_id).toBe(account.id);

            const me = await ownerAgent.get('/api/current_user');
            expect(me.body.user.is_admin).toBe(false);
            expect(me.body.user.role).toBe('account_admin');
        });

        it('puts a member into the account of whoever added it', async () => {
            const kid = await addMember(ownerAgent, {
                name: 'Kid',
                email: `kid_${stamp}@example.com`,
            });
            const ownerRow = await User.findByPk(owner.id);
            expect((await User.findByPk(kid.id)).account_id).toBe(
                ownerRow.account_id
            );
            expect(kid.role).toBe('user');
        });
    });

    describe('the Access page of an account admin', () => {
        it('lists only its own account', async () => {
            const kid = await addMember(ownerAgent, {
                name: 'Kid',
                email: `kid_${stamp}@example.com`,
            });
            await addMember(otherAgent, {
                name: 'Stranger',
                email: `stranger_${stamp}@example.com`,
            });

            const res = await ownerAgent.get('/api/admin/users');
            expect(res.status).toBe(200);
            const ids = res.body.map((u) => u.id).sort();
            expect(ids).toEqual([owner.id, kid.id].sort());
            const ownerEntry = res.body.find((u) => u.id === owner.id);
            expect(ownerEntry.is_account_owner).toBe(true);
            expect(ownerEntry.role).toBe('account_admin');

            const roles = await ownerAgent.get('/api/admin/roles');
            expect(roles.status).toBe(200);
            const counts = Object.fromEntries(
                roles.body.roles.map((r) => [r.id, r.member_count])
            );
            expect(counts).toEqual({ account_admin: 1, user: 1, guest: 0 });
        });

        it('lets the owner make a member an admin, who then manages the account', async () => {
            const partner = await addMember(ownerAgent, {
                name: 'Partner',
                email: `partner_${stamp}@example.com`,
            });
            const promoted = await ownerAgent
                .put(`/api/admin/users/${partner.id}`)
                .send({ role: 'account_admin' });
            expect(promoted.status).toBe(200);
            expect(promoted.body.role).toBe('account_admin');

            const partnerAgent = await login(partner.email);
            const kid = await addMember(partnerAgent, {
                name: 'Kid',
                email: `kid_${stamp}@example.com`,
                role: 'guest',
            });

            // The kid sits on the owner's subscription, not the partner's.
            expect((await User.findByPk(kid.id)).account_id).toBe(
                (await User.findByPk(owner.id)).account_id
            );
            const billing = await BillingAccount.findOne({
                where: { user_id: owner.id },
            });
            expect(billing.seat_quantity).toBe(3);

            const list = await partnerAgent.get('/api/admin/users');
            expect(list.status).toBe(200);
            expect(list.body.map((u) => u.id).sort()).toEqual(
                [owner.id, partner.id, kid.id].sort()
            );

            const kidUpdate = await partnerAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({
                    role: 'user',
                    capabilities: { create_projects: false },
                });
            expect(kidUpdate.status).toBe(200);
            expect(kidUpdate.body.role).toBe('user');
            expect(kidUpdate.body.capabilities.create_projects).toBe(false);
        });

        it('protects the owner from the other admins', async () => {
            const partner = await addMember(ownerAgent, {
                name: 'Partner',
                email: `partner_${stamp}@example.com`,
                role: 'account_admin',
            });
            const partnerAgent = await login(partner.email);

            const demote = await partnerAgent
                .put(`/api/admin/users/${owner.id}`)
                .send({ role: 'user' });
            const password = await partnerAgent
                .put(`/api/admin/users/${owner.id}`)
                .send({ password: 'takeover123' });
            const email = await partnerAgent
                .put(`/api/admin/users/${owner.id}`)
                .send({ email: `taken_${stamp}@example.com` });
            const remove = await partnerAgent.delete(
                `/api/admin/users/${owner.id}`
            );
            const selfDemote = await ownerAgent
                .put(`/api/admin/users/${owner.id}`)
                .send({ role: 'user' });

            expect(demote.status).toBe(400);
            expect(password.status).toBe(403);
            expect(email.status).toBe(403);
            expect(remove.status).toBe(403);
            expect(selfDemote.status).toBe(400);
            const ownerAfter = await User.findByPk(owner.id);
            expect(ownerAfter.email).toBe(owner.email);
            const me = await ownerAgent.get('/api/current_user');
            expect(me.body.user.role).toBe('account_admin');
        });

        it('lets an admin set a kid password and remove a member, freeing the seat', async () => {
            const kid = await addMember(ownerAgent, {
                name: 'Kid',
                email: `kid_${stamp}@example.com`,
            });
            const reset = await ownerAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ password: 'newpassword123' });
            expect(reset.status).toBe(200);

            const removed = await ownerAgent.delete(
                `/api/admin/users/${kid.id}`
            );
            expect(removed.status).toBe(204);
            expect(await User.findByPk(kid.id)).toBeNull();
            const billing = await BillingAccount.findOne({
                where: { user_id: owner.id },
            });
            expect(billing.seat_quantity).toBe(1);
        });

        it('is refused to a member who is not an admin', async () => {
            const kid = await addMember(ownerAgent, {
                name: 'Kid',
                email: `kid_${stamp}@example.com`,
            });
            const kidAgent = await login(kid.email);

            const list = await kidAgent.get('/api/admin/users');
            const promote = await kidAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ role: 'account_admin' });
            expect(list.status).toBe(403);
            expect(promote.status).toBe(403);
        });

        it("never reaches another account's members", async () => {
            const stranger = await addMember(otherAgent, {
                name: 'Stranger',
                email: `stranger_${stamp}@example.com`,
            });

            const update = await ownerAgent
                .put(`/api/admin/users/${stranger.id}`)
                .send({ name: 'Hijacked' });
            const remove = await ownerAgent.delete(
                `/api/admin/users/${stranger.id}`
            );
            const owner2 = await ownerAgent
                .put(`/api/admin/users/${otherOwner.id}`)
                .send({ role: 'user' });

            expect(update.status).toBe(404);
            expect(remove.status).toBe(404);
            expect(owner2.status).toBe(404);
            expect((await User.findByPk(stranger.id)).name).toBe('Stranger');
        });
    });

    describe('groups', () => {
        it('belong to one account, with names unique per account', async () => {
            const mine = await ownerAgent
                .post('/api/admin/groups')
                .send({ name: 'Kids' });
            const theirs = await otherAgent
                .post('/api/admin/groups')
                .send({ name: 'Kids' });
            expect(mine.status).toBe(201);
            expect(theirs.status).toBe(201);

            const duplicate = await ownerAgent
                .post('/api/admin/groups')
                .send({ name: 'kids' });
            expect(duplicate.status).toBe(409);

            const list = await ownerAgent.get('/api/admin/groups');
            expect(list.body.groups.map((g) => g.uid)).toEqual([
                mine.body.group.uid,
            ]);
            const picker = await ownerAgent.get('/api/groups');
            expect(picker.body.groups.map((g) => g.uid)).toEqual([
                mine.body.group.uid,
            ]);

            const peek = await ownerAgent.get(
                `/api/admin/groups/${theirs.body.group.uid}`
            );
            const rename = await ownerAgent
                .patch(`/api/admin/groups/${theirs.body.group.uid}`)
                .send({ name: 'Mine now' });
            const remove = await ownerAgent.delete(
                `/api/admin/groups/${theirs.body.group.uid}`
            );
            expect(peek.status).toBe(404);
            expect(rename.status).toBe(404);
            expect(remove.status).toBe(404);

            const superList = await superAgent.get('/api/admin/groups');
            const superUids = superList.body.groups.map((g) => g.uid);
            expect(superUids).toEqual(
                expect.arrayContaining([
                    mine.body.group.uid,
                    theirs.body.group.uid,
                ])
            );
        });

        it('take members only from the account', async () => {
            const kid = await addMember(ownerAgent, {
                name: 'Kid',
                email: `kid_${stamp}@example.com`,
            });
            const group = (
                await ownerAgent
                    .post('/api/admin/groups')
                    .send({ name: 'Kids' })
            ).body.group;

            const outsider = await ownerAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [otherOwner.id] });
            const own = await ownerAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [kid.id] });

            expect(outsider.status).toBe(400);
            expect(own.status).toBe(200);
            expect(own.body.added).toEqual([kid.id]);
        });

        it('cannot be shared with from another account', async () => {
            const theirs = (
                await otherAgent
                    .post('/api/admin/groups')
                    .send({ name: 'Theirs' })
            ).body.group;
            const project = await Project.create({
                name: 'Mine',
                user_id: owner.id,
            });

            const res = await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: theirs.uid,
                access_level: 'rw',
            });
            expect(res.status).toBe(404);
        });
    });

    describe('the superadmin', () => {
        it('is the only one', async () => {
            const viaUsers = await superAgent
                .put(`/api/admin/users/${owner.id}`)
                .send({ role: 'admin' });
            const viaSetRole = await superAgent
                .post('/api/admin/set-admin-role')
                .send({ user_id: otherOwner.id, is_admin: true });

            expect(viaUsers.status).toBe(400);
            expect(viaSetRole.status).toBe(400);
            expect(await Role.count({ where: { is_admin: true } })).toBe(1);
        });

        it('sees every account on the Access page', async () => {
            const res = await superAgent.get('/api/admin/users');
            const ids = res.body.map((u) => u.id);
            expect(ids).toEqual(
                expect.arrayContaining([superadmin.id, owner.id, otherOwner.id])
            );
            const roles = await superAgent.get('/api/admin/roles');
            expect(roles.body.roles.map((r) => r.id)).toEqual([
                'admin',
                'account_admin',
                'user',
                'guest',
            ]);
        });
    });

    describe('existing installs', () => {
        it('puts customers and their members into accounts when hosted mode starts', async () => {
            disableHosted();
            const legacyOwner = await createTestUser({
                email: `legacy_${stamp}@example.com`,
            });
            const legacyMember = await createTestUser({
                email: `legacykid_${stamp}@example.com`,
                created_by_user_id: legacyOwner.id,
            });
            const group = await UserGroup.create({
                name: `Legacy ${stamp}`,
                created_by_user_id: legacyOwner.id,
            });
            expect((await User.findByPk(legacyOwner.id)).account_id).toBeNull();

            enableHosted();
            await accountsService.backfill();

            const account = await Account.findOne({
                where: { owner_user_id: legacyOwner.id },
            });
            expect(account).not.toBeNull();
            expect((await User.findByPk(legacyMember.id)).account_id).toBe(
                account.id
            );
            expect((await group.reload()).account_id).toBe(account.id);
            const role = await Role.findOne({
                where: { user_id: legacyOwner.id },
            });
            expect(role.role).toBe('account_admin');

            const again = await accountsService.backfill();
            expect(again).toEqual({ users: 0, groups: 0 });
        });
    });

    describe('on a self-hosted instance', () => {
        beforeEach(() => {
            disableHosted();
        });

        it('create no accounts and offer no account admin role', async () => {
            const stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
            const before = await Account.count();
            const user = await createTestUser({
                email: `selfhosted_${stamp}@example.com`,
            });
            expect(await Account.count()).toBe(before);
            expect((await User.findByPk(user.id)).account_id).toBeNull();

            await Role.update({ is_admin: false }, { where: {} });
            await Role.update(
                { is_admin: true, role: 'admin' },
                { where: { user_id: user.id } }
            );
            const agent = await login(user.email);
            const roles = await agent.get('/api/admin/roles');
            expect(roles.body.roles.map((r) => r.id)).toEqual([
                'admin',
                'user',
                'guest',
            ]);

            const other = await createTestUser({
                email: `selfhosted2_${stamp}@example.com`,
            });
            const res = await agent
                .put(`/api/admin/users/${other.id}`)
                .send({ role: 'account_admin' });
            expect(res.status).toBe(400);

            // A second admin is still fine on a self-hosted instance.
            const second = await agent
                .put(`/api/admin/users/${other.id}`)
                .send({ role: 'admin' });
            expect(second.status).toBe(200);
        });
    });
});
