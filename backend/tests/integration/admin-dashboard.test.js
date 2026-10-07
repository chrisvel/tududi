const request = require('supertest');
const app = require('../../app');
const {
    Role,
    WaitlistSubscriber,
    BillingAccount,
    Project,
    Task,
    Note,
    Tag,
    Person,
} = require('../../models');
const { getConfig } = require('../../config/config');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Admin dashboard', () => {
    let admin, adminAgent, plain, plainAgent;

    beforeEach(async () => {
        admin = await createTestUser({
            email: `adm_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        adminAgent = await login(admin);

        plain = await createTestUser({
            email: `usr_${Date.now()}@example.com`,
        });
        plainAgent = await login(plain);
    });

    it('counts users, content and the waitlist', async () => {
        await WaitlistSubscriber.create({
            email: `w1_${Date.now()}@example.com`,
            source: 'hero',
        });

        const res = await adminAgent.get('/api/admin/overview');
        expect(res.status).toBe(200);
        expect(res.body.users.total).toBeGreaterThanOrEqual(2);
        expect(res.body.users.admins).toBeGreaterThanOrEqual(1);
        expect(res.body.waitlist.total).toBeGreaterThanOrEqual(1);
        expect(res.body.billing).toHaveProperty('paying');
        expect(res.body.instance).toHaveProperty('registration_enabled');
        expect(typeof res.body.instance.version).toBe('string');
    });

    it('reports 14 days of signups, activation and active users', async () => {
        await Task.create({ name: 'First', user_id: plain.id });

        const res = await adminAgent.get('/api/admin/overview');
        expect(res.status).toBe(200);
        const { trends } = res.body;
        expect(trends.days).toHaveLength(14);
        expect(trends.days[13].date).toBe(
            new Date().toISOString().slice(0, 10)
        );
        expect(trends.days[13].signups).toBeGreaterThanOrEqual(2);
        expect(trends.signups.last7d).toBe(
            trends.days.slice(7).reduce((n, d) => n + d.signups, 0)
        );
        expect(trends.activation.new_users).toBeGreaterThanOrEqual(2);
        expect(trends.activation.activated).toBeGreaterThanOrEqual(1);
        expect(trends.activation.activated).toBeLessThan(
            trends.activation.new_users
        );
        expect(trends.active_users_7d).toBeGreaterThanOrEqual(1);
        expect(trends.billing).toBeNull();
    });

    it('adds trial and churn signals on a hosted instance', async () => {
        const hosted = getConfig().hosted;
        const saved = { enabled: hosted.enabled };
        hosted.enabled = true;
        entitlements.invalidate();
        const DAY = 24 * 60 * 60 * 1000;
        try {
            await BillingAccount.create({
                user_id: plain.id,
                plan: 'free',
                status: 'none',
                trial_started_at: new Date(Date.now() - DAY),
                trial_ends_at: new Date(Date.now() + 3 * DAY),
            });
            await BillingAccount.create({
                user_id: admin.id,
                plan: 'pro',
                status: 'canceled',
                canceled_at: new Date(Date.now() - DAY),
                last_payment_failed_at: new Date(Date.now() - 2 * DAY),
            });

            const res = await adminAgent.get('/api/admin/overview');
            expect(res.body.trends.billing).toEqual({
                trials_started_7d: 1,
                trials_ending_7d: 1,
                canceled_7d: 1,
                payment_failed_7d: 1,
            });
        } finally {
            Object.assign(hosted, saved);
            entitlements.invalidate();
        }
    });

    it('lists users with their trial, days left and payment', async () => {
        const hosted = getConfig().hosted;
        const saved = { enabled: hosted.enabled };
        hosted.enabled = true;
        entitlements.invalidate();
        const DAY = 24 * 60 * 60 * 1000;
        try {
            await BillingAccount.create({
                user_id: plain.id,
                plan: 'free',
                status: 'none',
                trial_started_at: new Date(Date.now() - DAY),
                trial_ends_at: new Date(Date.now() + 9.5 * DAY),
            });
            const payer = await createTestUser({
                email: `pay_${Date.now()}@example.com`,
            });
            await BillingAccount.create({
                user_id: payer.id,
                plan: 'pro',
                status: 'active',
                provider_subscription_id: 'sub_1',
            });

            const res = await adminAgent.get('/api/admin/overview/users');
            expect(res.status).toBe(200);
            expect(res.body.hosted).toBe(true);
            const byId = new Map(res.body.users.map((u) => [u.id, u]));

            const trial = byId.get(plain.id);
            expect(trial.access).toBe('trial');
            expect(trial.trial_days_left).toBe(10);
            expect(trial.paid).toBe(false);
            expect(trial).not.toHaveProperty('password_digest');

            const paying = byId.get(payer.id);
            expect(paying.access).toBe('subscription');
            expect(paying.paid).toBe(true);
            expect(paying.trial_days_left).toBeNull();

            expect(byId.get(admin.id).access).toBe('admin');
        } finally {
            Object.assign(hosted, saved);
            entitlements.invalidate();
        }
    });

    it('counts the items each user created', async () => {
        const project = await Project.create({
            name: 'P',
            user_id: plain.id,
        });
        const parent = await Task.create({
            name: 'Weekly',
            user_id: plain.id,
            project_id: project.id,
            recurrence_type: 'weekly',
        });
        await Task.create({
            name: 'Generated',
            user_id: plain.id,
            recurring_parent_id: parent.id,
        });
        await Task.create({ name: 'Run', user_id: plain.id, habit_mode: true });
        await Note.create({ title: 'N', content: 'x', user_id: plain.id });
        await Tag.create({ name: 'home', user_id: plain.id });
        await Person.create({ name: 'Alex', user_id: plain.id });

        const res = await adminAgent.get('/api/admin/overview/users');
        expect(res.status).toBe(200);
        const byId = new Map(res.body.users.map((u) => [u.id, u]));

        const usage = byId.get(plain.id).usage;
        expect(usage.counts).toEqual({
            tasks: 1,
            habits: 1,
            projects: 1,
            notes: 1,
            tags: 1,
            people: 1,
        });
        expect(usage.total).toBe(6);
        expect(usage.last_created_at).not.toBeNull();

        expect(byId.get(admin.id).usage).toEqual({
            total: 0,
            counts: {},
            last_created_at: null,
        });
    });

    it('keeps the user list from regular users', async () => {
        const res = await plainAgent.get('/api/admin/overview/users');
        expect(res.status).toBe(403);
    });

    it('lists the waitlist newest first', async () => {
        const older = await WaitlistSubscriber.create({
            email: `old_${Date.now()}@example.com`,
            source: 'footer',
            created_at: new Date(Date.now() - 60000),
        });
        const newer = await WaitlistSubscriber.create({
            email: `new_${Date.now()}@example.com`,
            source: 'hero',
        });

        const res = await adminAgent.get('/api/admin/waitlist?limit=10');
        expect(res.status).toBe(200);
        const emails = res.body.subscribers.map((s) => s.email);
        expect(emails).toContain(newer.email);
        expect(emails).toContain(older.email);
        expect(emails.indexOf(newer.email)).toBeLessThan(
            emails.indexOf(older.email)
        );
    });

    it('narrows the list to a search fragment', async () => {
        const wanted = `needle_${Date.now()}@example.com`;
        await WaitlistSubscriber.create({ email: wanted, source: 'hero' });
        await WaitlistSubscriber.create({
            email: `other_${Date.now()}@example.com`,
            source: 'hero',
        });

        // Uppercase on purpose: addresses are stored lowercased, so the
        // query has to be lowered before it is matched.
        const res = await adminAgent.get(
            `/api/admin/waitlist?q=${encodeURIComponent('NEEDLE_')}`
        );
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.subscribers[0].email).toBe(wanted);
    });

    it('exports every address as CSV', async () => {
        const email = `csv_${Date.now()}@example.com`;
        await WaitlistSubscriber.create({
            email,
            source: 'pricing',
            locale: 'de',
            ip_address: '203.0.113.5',
        });

        const res = await adminAgent.get('/api/admin/waitlist/export');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(
            /attachment; filename="waitlist-\d{4}-\d{2}-\d{2}\.csv"/
        );
        expect(res.text.split('\r\n')[0]).toBe(
            '"email","source","locale","ip_address","submissions","joined_at"'
        );
        expect(res.text).toContain(
            `"${email}","pricing","de","203.0.113.5","1"`
        );
    });

    it('removes an entry from the waitlist', async () => {
        const entry = await WaitlistSubscriber.create({
            email: `remove_${Date.now()}@example.com`,
            source: 'hero',
        });

        const res = await adminAgent.delete(`/api/admin/waitlist/${entry.id}`);
        expect(res.status).toBe(204);
        expect(await WaitlistSubscriber.findByPk(entry.id)).toBeNull();
    });

    it('404s removing an entry that is not there', async () => {
        const res = await adminAgent.delete('/api/admin/waitlist/999999999');
        expect(res.status).toBe(404);
    });

    it('refuses removal to a non-admin', async () => {
        const entry = await WaitlistSubscriber.create({
            email: `noperm_${Date.now()}@example.com`,
            source: 'hero',
        });
        const res = await plainAgent.delete(`/api/admin/waitlist/${entry.id}`);
        expect(res.status).toBe(403);
        expect(await WaitlistSubscriber.findByPk(entry.id)).not.toBeNull();
    });

    it('refuses both endpoints to a non-admin', async () => {
        expect((await plainAgent.get('/api/admin/overview')).status).toBe(403);
        expect((await plainAgent.get('/api/admin/waitlist')).status).toBe(403);
        expect(
            (await plainAgent.get('/api/admin/waitlist/export')).status
        ).toBe(403);
    });

    it('refuses both endpoints when signed out', async () => {
        expect((await request(app).get('/api/admin/overview')).status).toBe(
            401
        );
        expect((await request(app).get('/api/admin/waitlist')).status).toBe(
            401
        );
    });
});
