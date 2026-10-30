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
    User,
    Person,
    Task,
    Notification,
    BillingAccount,
    sequelize,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const rolesService = require('../../services/rolesService');
const { createTestUser } = require('../helpers/testUtils');

// Removing a member used to leave their open tasks unassigned without telling
// anyone (#2019). The remover can now pick who takes them over.

const config = getConfig();

const login = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

const addMember = async (agent, body) => {
    const res = await agent
        .post('/api/members')
        .send({ password: 'password123', ...body });
    if (res.status !== 201) {
        throw new Error(
            `could not add a member: ${res.status} ${JSON.stringify(res.body)}`
        );
    }
    return res.body;
};

const selfPerson = (userId) =>
    Person.findOne({ where: { user_id: userId, linked_user_id: userId } });

describe('Removing a member hands their open tasks over', () => {
    let stamp, lead, leadAgent, bea, cal, beaUid, calUid;
    let open, subtask, done, cancelled;

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        // The first account is the admin; the lead is an ordinary user who
        // may add members, so removal goes through "whoever created it".
        await createTestUser({ email: `admin_${stamp}@example.com` });
        lead = await createTestUser({
            email: `lead_${stamp}@example.com`,
            name: 'Lea',
        });
        await rolesService.setRole(lead.id, 'user');
        await rolesService.setCapabilities(lead.id, { invite_members: true });
        leadAgent = await login(lead.email);

        bea = await addMember(leadAgent, {
            email: `bea_${stamp}@example.com`,
            name: 'Bea',
        });
        cal = await addMember(leadAgent, {
            email: `cal_${stamp}@example.com`,
            name: 'Cal',
        });
        beaUid = bea.person_uid;
        calUid = cal.person_uid;

        open = await Task.create({
            name: 'Open task',
            user_id: lead.id,
            assigned_to: beaUid,
            status: Task.STATUS.IN_PROGRESS,
        });
        subtask = await Task.create({
            name: 'Open subtask',
            user_id: lead.id,
            parent_task_id: open.id,
            assigned_to: beaUid,
            status: Task.STATUS.NOT_STARTED,
        });
        done = await Task.create({
            name: 'Done task',
            user_id: lead.id,
            assigned_to: beaUid,
            status: Task.STATUS.DONE,
        });
        cancelled = await Task.create({
            name: 'Cancelled task',
            user_id: lead.id,
            assigned_to: beaUid,
            status: Task.STATUS.CANCELLED,
        });
    });

    const assigneeOf = async (task) =>
        (await Task.findByPk(task.id)).assigned_to;

    describe('GET /api/members/:id/handoff', () => {
        it('counts the open tasks and offers the remover first', async () => {
            const res = await leadAgent.get(`/api/members/${bea.id}/handoff`);

            expect(res.status).toBe(200);
            expect(res.body.open_assigned_tasks).toBe(2);
            expect(res.body.candidates[0]).toMatchObject({
                id: lead.id,
                is_self: true,
            });
            const ids = res.body.candidates.map((c) => c.id);
            expect(ids).toContain(cal.id);
            expect(ids).not.toContain(bea.id);
        });

        it('is not found for someone who does not manage the member', async () => {
            const res = await (
                await login(`cal_${stamp}@example.com`)
            ).get(`/api/members/${bea.id}/handoff`);

            expect(res.status).toBe(404);
        });
    });

    describe('with reassign_to', () => {
        it('moves the open tasks to the chosen member and leaves closed ones alone', async () => {
            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: cal.id });

            expect(res.status).toBe(204);
            expect(await User.findByPk(bea.id)).toBeNull();
            expect(await assigneeOf(open)).toBe(calUid);
            expect(await assigneeOf(subtask)).toBe(calUid);
            expect(await assigneeOf(done)).not.toBe(calUid);
            expect(await assigneeOf(cancelled)).not.toBe(calUid);
        });

        it('takes the person uid as well', async () => {
            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: calUid });

            expect(res.status).toBe(204);
            expect(await assigneeOf(open)).toBe(calUid);
        });

        it('sends the new assignee one notice with the count', async () => {
            await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: cal.id });

            const notices = await Notification.findAll({
                where: { user_id: cal.id, type: 'task_assigned' },
            });
            expect(notices).toHaveLength(1);
            expect(notices[0].title).toBe('Lea handed you 2 tasks from Bea');
            expect(notices[0].data).toMatchObject({
                reason: 'member_removed',
                count: 2,
            });
        });

        it('lets the remover take the tasks, without a notice to themselves', async () => {
            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: lead.id });

            expect(res.status).toBe(204);
            expect(await assigneeOf(open)).toBe(
                (await selfPerson(lead.id)).uid
            );
            expect(
                await Notification.count({ where: { user_id: lead.id } })
            ).toBe(0);
        });
    });

    describe('without reassign_to', () => {
        it('leaves the open tasks unassigned, as before', async () => {
            const res = await leadAgent.delete(`/api/members/${bea.id}`);

            expect(res.status).toBe(204);
            expect(await User.findByPk(bea.id)).toBeNull();
            expect(await assigneeOf(open)).toBeNull();
            expect(await assigneeOf(subtask)).toBeNull();
            expect(
                await Notification.count({ where: { user_id: cal.id } })
            ).toBe(0);
        });
    });

    describe('an invalid reassign_to removes nothing', () => {
        const expectNothingRemoved = async () => {
            expect(await User.findByPk(bea.id)).not.toBeNull();
            expect(await assigneeOf(open)).toBe(beaUid);
        };

        it('refuses the member being removed', async () => {
            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: bea.id });

            expect(res.status).toBe(400);
            await expectNothingRemoved();
        });

        it('refuses someone outside the workspace', async () => {
            const stranger = await createTestUser({
                email: `stranger_${stamp}@example.com`,
            });

            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: stranger.id });

            expect(res.status).toBe(404);
            await expectNothingRemoved();
        });

        it('refuses an account that does not exist', async () => {
            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: 99999999 });

            expect(res.status).toBe(404);
            await expectNothingRemoved();
        });

        it('refuses a contact card, which is not a member', async () => {
            const contact = await Person.create({
                name: `Plumber ${stamp}`,
                user_id: lead.id,
            });

            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: contact.uid });

            expect(res.status).toBe(404);
            await expectNothingRemoved();
        });

        it('refuses text that is neither an id nor a uid', async () => {
            const res = await leadAgent
                .delete(`/api/members/${bea.id}`)
                .send({ reassign_to: { id: cal.id } });

            expect(res.status).toBe(400);
            await expectNothingRemoved();
        });
    });

    describe('on tududi Cloud', () => {
        let owner, ownerAgent, mia, ned, otherOwner, outsider;
        const realFetch = global.fetch;

        const subscribe = (userId) =>
            BillingAccount.create({
                user_id: userId,
                provider: 'lemonsqueezy',
                provider_subscription_id: `sub_${userId}`,
                provider_subscription_item_id: `item_${userId}`,
                status: 'active',
                plan: 'team_5',
            });

        beforeEach(async () => {
            global.fetch = async () =>
                new Response('not found', { status: 404 });
            config.hosted.enabled = true;
            config.hosted.billing.provider = 'lemonsqueezy';
            config.hosted.lemonsqueezy.apiKey = 'ls_test_key';
            config.hosted.lemonsqueezy.storeId = '1';
            config.hosted.lemonsqueezy.webhookSecret = 'secret';
            config.hosted.lemonsqueezy.variants.proMonthly = '100';
            plans._resetCache();
            entitlements.invalidate();

            owner = await createTestUser({
                email: `owner_${stamp}@example.com`,
                name: 'Olga',
            });
            otherOwner = await createTestUser({
                email: `other_${stamp}@example.com`,
                name: 'Otto',
            });
            await subscribe(owner.id);
            await subscribe(otherOwner.id);
            ownerAgent = await login(owner.email);
            const otherAgent = await login(otherOwner.email);

            mia = await addMember(ownerAgent, {
                email: `mia_${stamp}@example.com`,
                name: 'Mia',
            });
            ned = await addMember(ownerAgent, {
                email: `ned_${stamp}@example.com`,
                name: 'Ned',
            });
            outsider = await addMember(otherAgent, {
                email: `outsider_${stamp}@example.com`,
                name: 'Out',
            });
            open = await Task.create({
                name: 'Cloud task',
                user_id: owner.id,
                assigned_to: mia.person_uid,
                status: Task.STATUS.NOT_STARTED,
            });
        });

        afterEach(() => {
            global.fetch = realFetch;
            config.hosted.enabled = false;
            config.hosted.billing.provider = 'stripe';
            config.hosted.lemonsqueezy.apiKey = undefined;
            config.hosted.lemonsqueezy.storeId = undefined;
            config.hosted.lemonsqueezy.webhookSecret = undefined;
            config.hosted.lemonsqueezy.variants.proMonthly = undefined;
            plans._resetCache();
            entitlements.invalidate();
        });

        it('offers only members of the same account', async () => {
            const res = await ownerAgent.get(`/api/members/${mia.id}/handoff`);

            expect(res.status).toBe(200);
            const ids = res.body.candidates.map((c) => c.id);
            expect(ids).toEqual(expect.arrayContaining([owner.id, ned.id]));
            expect(ids).not.toContain(outsider.id);
            expect(ids).not.toContain(mia.id);
        });

        it('hands the tasks to another member of the account', async () => {
            const res = await ownerAgent
                .delete(`/api/members/${mia.id}`)
                .send({ reassign_to: ned.person_uid });

            expect(res.status).toBe(204);
            expect((await Task.findByPk(open.id)).assigned_to).toBe(
                ned.person_uid
            );
        });

        it('refuses a member of another account and removes nothing', async () => {
            const res = await ownerAgent
                .delete(`/api/members/${mia.id}`)
                .send({ reassign_to: outsider.id });

            expect(res.status).toBe(404);
            expect(await User.findByPk(mia.id)).not.toBeNull();
            expect((await Task.findByPk(open.id)).assigned_to).toBe(
                mia.person_uid
            );
        });
    });
});
