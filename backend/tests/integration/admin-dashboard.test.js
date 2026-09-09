const request = require('supertest');
const app = require('../../app');
const { Role, WaitlistSubscriber } = require('../../models');
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
        });

        const res = await adminAgent.get('/api/admin/waitlist/export');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(
            /attachment; filename="waitlist-\d{4}-\d{2}-\d{2}\.csv"/
        );
        expect(res.text.split('\r\n')[0]).toBe(
            '"email","source","locale","submissions","joined_at"'
        );
        expect(res.text).toContain(`"${email}","pricing","de","1"`);
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
