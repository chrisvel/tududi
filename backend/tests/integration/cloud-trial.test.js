const request = require('supertest');
const app = require('../../app');
const { getConfig } = require('../../config/config');
const { BillingAccount, Note, Role, User } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const {
    createUnverifiedUser,
    verifyUserEmail,
} = require('../../modules/auth/registrationService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

let seq = 0;
const uniqueEmail = (prefix) => `${prefix}_${Date.now()}_${seq++}@example.com`;

// A Cloud trial: it starts when the email is verified, leaves out AI, public
// notes and members, then turns read-only for a month and is deleted.
describe('Cloud trials', () => {
    beforeEach(() => {
        config.hosted.enabled = true;
        config.hosted.requireSubscription = true;
        config.hosted.trialDays = 14;
        config.hosted.trialReadOnlyDays = 30;
        config.hosted.deleteExpiredTrials = true;
        entitlements.invalidate();
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.requireSubscription = false;
        config.hosted.trialDays = 14;
        entitlements.invalidate();
    });

    describe('starting', () => {
        it('starts when the email is verified, not at sign-up', async () => {
            const { user, verificationToken } = await createUnverifiedUser(
                uniqueEmail('verify'),
                'password123'
            );
            let account = await entitlements.ensureAccount(user.id);
            expect(account.trial_ends_at).toBeFalsy();

            await verifyUserEmail(verificationToken);
            account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.trial_started_at).not.toBeNull();
            expect(account.trial_ends_at.getTime()).toBeGreaterThan(
                Date.now() + 13 * DAY
            );
        });

        it('gives no trial to a member added by an owner', async () => {
            const owner = await createTestUser({ email: uniqueEmail('owner') });
            const member = await createTestUser({
                email: uniqueEmail('member'),
                created_by_user_id: owner.id,
            });
            expect(await entitlements.startTrial(member.id)).toBeNull();
        });

        it('refuses a sign-up whose mailbox already has an account', async () => {
            const base = `jane.doe${Date.now()}`;
            await createTestUser({ email: `${base}@gmail.com` });

            const alias = `${base.replace('.', '')}+trial2@googlemail.com`;
            await expect(
                createUnverifiedUser(alias, 'password123')
            ).rejects.toThrow('Email already registered');
        });

        it('allows alias accounts on a self-hosted instance', async () => {
            config.hosted.enabled = false;
            const base = `selfhost${Date.now()}`;
            await createTestUser({ email: `${base}@example.com` });
            const { user } = await createUnverifiedUser(
                `${base}+second@example.com`,
                'password123'
            );
            expect(user.email_canonical).toBe(`${base}@example.com`);
        });
    });

    describe('during the trial', () => {
        let user, agent;

        beforeEach(async () => {
            user = await createTestUser({ email: uniqueEmail('trial') });
            await entitlements.startTrial(user.id);
            agent = await login(user);
        });

        it('opens the app', async () => {
            const res = await agent.get('/api/tasks');
            expect(res.status).toBe(200);
            const create = await agent.post('/api/task').send({ name: 'Yes' });
            expect(create.status).toBe(201);
        });

        it('leaves out the AI assistant', async () => {
            const res = await agent.post('/api/ai-assistant/daily-brief');
            expect(res.status).toBe(402);
            expect(res.body.code).toBe('FEATURE_NOT_IN_PLAN');
            expect(res.body.details).toEqual({ feature: 'ai', plan: 'trial' });
        });

        it('leaves out public note links, but turning one off still works', async () => {
            const note = await Note.create({ title: 'n', user_id: user.id });
            const res = await agent.post(`/api/note/${note.uid}/public-share`);
            expect(res.status).toBe(402);
            expect(res.body.details).toEqual({
                feature: 'public_notes',
                plan: 'trial',
            });

            const off = await agent.delete(
                `/api/note/${note.uid}/public-share`
            );
            expect(off.status).not.toBe(402);
        });

        it('leaves out adding members', async () => {
            const res = await agent
                .post('/api/members')
                .send({ name: 'Kid', email: uniqueEmail('kid') });
            expect(res.status).toBe(402);
            expect(res.body.code).toBe('FEATURE_NOT_IN_PLAN');
            expect(res.body.details).toEqual({
                feature: 'members',
                plan: 'trial',
            });
        });
    });

    describe('after the trial', () => {
        let user, agent;

        const endTrial = async (u, endedDaysAgo) => {
            await BillingAccount.update(
                {
                    trial_started_at: daysAgo(endedDaysAgo + 14),
                    trial_ends_at: daysAgo(endedDaysAgo),
                },
                { where: { user_id: u.id } }
            );
            entitlements.invalidate();
        };

        beforeEach(async () => {
            user = await createTestUser({ email: uniqueEmail('ended') });
            await entitlements.startTrial(user.id);
            agent = await login(user);
        });

        it('is read-only for the read-only window', async () => {
            await endTrial(user, 5);

            const read = await agent.get('/api/tasks');
            expect(read.status).toBe(200);

            const write = await agent.post('/api/task').send({ name: 'No' });
            expect(write.status).toBe(402);
            expect(write.body.code).toBe('TRIAL_ENDED');

            const billing = await agent.get('/api/billing');
            expect(billing.body.active).toBe(false);
            expect(billing.body.read_only).toBe(true);
            expect(
                new Date(billing.body.read_only_until).getTime()
            ).toBeGreaterThan(Date.now() + 24 * DAY);
        });

        it('closes entirely once the window has passed', async () => {
            await endTrial(user, 31);
            const read = await agent.get('/api/tasks');
            expect(read.status).toBe(402);
            expect(read.body.code).toBe('SUBSCRIPTION_REQUIRED');
        });

        it('is not read-only, but closed, for an older account without a started trial', async () => {
            await BillingAccount.update(
                { trial_started_at: null, trial_ends_at: daysAgo(5) },
                { where: { user_id: user.id } }
            );
            entitlements.invalidate();
            const read = await agent.get('/api/tasks');
            expect(read.status).toBe(402);
            expect(read.body.code).toBe('SUBSCRIPTION_REQUIRED');
        });
    });

    describe('deleting expired trials', () => {
        const expiredTrialUser = async (prefix, endedDaysAgo = 31) => {
            const u = await createTestUser({ email: uniqueEmail(prefix) });
            await entitlements.startTrial(u.id);
            await BillingAccount.update(
                {
                    trial_started_at: daysAgo(endedDaysAgo + 14),
                    trial_ends_at: daysAgo(endedDaysAgo),
                },
                { where: { user_id: u.id } }
            );
            return u;
        };

        it('deletes only unpaid trials past the read-only window', async () => {
            const expired = await expiredTrialUser('gone');
            const inWindow = await expiredTrialUser('window', 10);

            const legacy = await createTestUser({
                email: uniqueEmail('legacy'),
            });
            await BillingAccount.create({
                user_id: legacy.id,
                trial_ends_at: daysAgo(90),
            });

            const subscribed = await expiredTrialUser('paid');
            await BillingAccount.update(
                { status: 'active', provider_subscription_id: 'sub_1' },
                { where: { user_id: subscribed.id } }
            );

            const comped = await expiredTrialUser('comp');
            await BillingAccount.update(
                { override_plan: 'pro' },
                { where: { user_id: comped.id } }
            );

            const admin = await expiredTrialUser('admin');
            await Role.update(
                { is_admin: true },
                { where: { user_id: admin.id } }
            );

            const deleted = await entitlements.deleteExpiredTrials();
            expect(deleted).toEqual([expired.id]);
            expect(await User.findByPk(expired.id)).toBeNull();
            for (const kept of [inWindow, legacy, subscribed, comped, admin]) {
                expect(await User.findByPk(kept.id)).not.toBeNull();
            }
        });

        it('deletes nothing where access is not sold', async () => {
            const expired = await expiredTrialUser('freetier');
            config.hosted.requireSubscription = false;
            expect(await entitlements.deleteExpiredTrials()).toEqual([]);
            expect(await User.findByPk(expired.id)).not.toBeNull();
        });

        it('deletes nothing when switched off', async () => {
            const expired = await expiredTrialUser('switch');
            config.hosted.deleteExpiredTrials = false;
            expect(await entitlements.deleteExpiredTrials()).toEqual([]);
            expect(await User.findByPk(expired.id)).not.toBeNull();
        });
    });
});
