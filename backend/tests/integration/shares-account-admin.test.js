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
    Area,
    BillingAccount,
    Notification,
    Project,
    Role,
    sequelize,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

// On tududi Cloud a share from an admin of the recipient's own account
// applies at once, with a notice instead of an invitation. Shares between
// accounts, shares by members who are not admins, and every share on a
// self-hosted instance stay invitations.

const config = getConfig();

const realFetch = global.fetch;
const mockFetch = async () => new Response('not found', { status: 404 });

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

const login = async (email, password = 'password123') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/login').send({ email, password });
    if (res.status !== 200) {
        throw new Error(`could not sign in ${email}: ${res.status}`);
    }
    return agent;
};

const subscribe = (userId) =>
    BillingAccount.create({
        user_id: userId,
        provider: 'lemonsqueezy',
        provider_subscription_id: `sub_${userId}`,
        provider_subscription_item_id: `item_${userId}`,
        status: 'active',
        plan: 'team_5',
    });

const parseData = (notification) =>
    typeof notification.data === 'string'
        ? JSON.parse(notification.data)
        : notification.data;

const shareNotifications = (userId) =>
    Notification.findAll({
        where: { user_id: userId, type: 'share_invitation' },
    });

const invitationsFor = async (agent) => {
    const res = await agent.get('/api/shares/invitations');
    expect(res.status).toBe(200);
    return res.body.invitations;
};

describe('Shares from an admin of your own account', () => {
    let stamp, owner, otherOwner, alice, bob;
    let ownerAgent, otherAgent, aliceAgent, bobAgent;

    const addMember = async (agent, name) => {
        const res = await agent.post('/api/members').send({
            password: 'password123',
            name,
            email: `${name.toLowerCase()}_${stamp}@example.com`,
        });
        if (res.status !== 201) {
            throw new Error(
                `could not add a member: ${res.status} ${JSON.stringify(res.body)}`
            );
        }
        return res.body;
    };

    const share = (agent, body) =>
        agent.post('/api/shares').send({ access_level: 'rw', ...body });

    beforeAll(() => {
        global.fetch = mockFetch;
    });

    afterAll(async () => {
        global.fetch = realFetch;
        await sequelize.close();
    });

    afterEach(() => {
        disableHosted();
    });

    describe('on a hosted instance', () => {
        beforeEach(async () => {
            enableHosted();
            stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
            // Sequential, with the instance admin role cleared, so nobody
            // here is the superadmin.
            owner = await createTestUser({
                email: `owner_${stamp}@example.com`,
                name: 'Owner',
            });
            otherOwner = await createTestUser({
                email: `other_${stamp}@example.com`,
                name: 'Other',
            });
            await Role.update({ is_admin: false }, { where: {} });
            await subscribe(owner.id);
            await subscribe(otherOwner.id);
            ownerAgent = await login(owner.email);
            otherAgent = await login(otherOwner.email);

            alice = await addMember(ownerAgent, 'Alice');
            bob = await addMember(ownerAgent, 'Bob');
            aliceAgent = await login(alice.email);
            bobAgent = await login(bob.email);
        });

        it('applies a project share from the account owner at once', async () => {
            const project = await Project.create({
                name: 'Launch',
                user_id: owner.id,
            });

            const res = await share(ownerAgent, {
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_id: alice.id,
            });
            expect(res.status).toBe(204);

            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(200);
            expect(await invitationsFor(aliceAgent)).toEqual([]);

            const notifications = await shareNotifications(alice.id);
            expect(notifications).toHaveLength(1);
            const data = parseData(notifications[0]);
            expect(data.invitationId).toBeNull();
            expect(data.accepted).toBe(true);
            expect(data.projectUid).toBe(project.uid);
            expect(notifications[0].title).toBe(
                'Owner shared a project with you'
            );
        });

        it('applies a share from a member made admin of the account', async () => {
            const promoted = await ownerAgent
                .put(`/api/admin/users/${bob.id}`)
                .send({ role: 'account_admin' });
            expect(promoted.status).toBe(200);
            const project = await Project.create({
                name: 'Bob project',
                user_id: bob.id,
            });

            await share(bobAgent, {
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_id: alice.id,
            });

            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(200);
            expect(await invitationsFor(aliceAgent)).toEqual([]);
        });

        it('applies an area share with a group to every member and every project in it', async () => {
            const group = (
                await ownerAgent
                    .post('/api/admin/groups')
                    .send({ name: 'Team' })
            ).body.group;
            const added = await ownerAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [alice.id] });
            expect(added.status).toBe(200);

            const area = await Area.create({
                name: 'Clients',
                user_id: owner.id,
            });
            const before = await Project.create({
                name: 'Before',
                user_id: owner.id,
                area_id: area.id,
            });

            const res = await share(ownerAgent, {
                resource_type: 'area',
                resource_uid: area.uid,
                target_group_uid: group.uid,
            });
            expect(res.status).toBe(204);

            // A project added to the area afterwards follows the area.
            const after = (
                await ownerAgent
                    .post('/api/project')
                    .send({ name: 'After', area_id: area.id })
            ).body;

            // A member who joins the group later is treated the same way.
            const late = await ownerAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [bob.id] });
            expect(late.status).toBe(200);

            for (const [user, agent] of [
                [alice, aliceAgent],
                [bob, bobAgent],
            ]) {
                expect((await agent.get(`/api/areas/${area.uid}`)).status).toBe(
                    200
                );
                expect(
                    (await agent.get(`/api/project/${before.uid}`)).status
                ).toBe(200);
                expect(
                    (await agent.get(`/api/project/${after.uid}`)).status
                ).toBe(200);
                expect(await invitationsFor(agent)).toEqual([]);

                const notifications = await shareNotifications(user.id);
                expect(notifications).toHaveLength(1);
                expect(parseData(notifications[0]).invitationId).toBeNull();
            }
        });

        it('keeps a share from a member who is not an admin pending', async () => {
            const project = await Project.create({
                name: 'Alice project',
                user_id: alice.id,
            });

            await share(aliceAgent, {
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_id: bob.id,
            });

            expect(
                (await bobAgent.get(`/api/project/${project.uid}`)).status
            ).not.toBe(200);
            expect(await invitationsFor(bobAgent)).toHaveLength(1);
        });

        it('keeps a share with someone in another account pending', async () => {
            const project = await Project.create({
                name: 'Outside',
                user_id: owner.id,
            });

            await share(ownerAgent, {
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: otherOwner.email,
            });

            expect(
                (await otherAgent.get(`/api/project/${project.uid}`)).status
            ).not.toBe(200);
            expect(await invitationsFor(otherAgent)).toHaveLength(1);
            const notifications = await shareNotifications(otherOwner.id);
            expect(notifications).toHaveLength(1);
            expect(parseData(notifications[0]).invitationId).not.toBeNull();
        });
    });

    describe('on a self-hosted instance', () => {
        it('keeps every share pending, even from an admin', async () => {
            stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
            const admin = await createTestUser({
                email: `admin_${stamp}@example.com`,
                name: 'Admin',
            });
            const member = await createTestUser({
                email: `member_${stamp}@example.com`,
                name: 'Member',
            });
            await Role.update({ is_admin: false }, { where: {} });
            await Role.update(
                { is_admin: true, role: 'admin' },
                { where: { user_id: admin.id } }
            );
            const adminAgent = await login(admin.email);
            const memberAgent = await login(member.email);
            const project = await Project.create({
                name: 'Home',
                user_id: admin.id,
            });

            const res = await share(adminAgent, {
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: member.email,
            });
            expect(res.status).toBe(204);

            expect(
                (await memberAgent.get(`/api/project/${project.uid}`)).status
            ).not.toBe(200);
            expect(await invitationsFor(memberAgent)).toHaveLength(1);
        });
    });
});
