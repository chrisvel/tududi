const request = require('supertest');
const app = require('../../app');
const { Setting, WaitlistSubscriber } = require('../../models');
const { getConfig } = require('../../config/config');

// The app host's half of the waitlist: while hosted Cloud is shut nobody can
// register, and the register page captures the address itself rather than
// handing it to a third party.
describe('Waitlist on the app host', () => {
    const config = getConfig();
    const originalHosted = config.hosted.enabled;
    const originalCloudOpen = config.pricing.cloudOpen;

    beforeEach(async () => {
        await Setting.upsert({ key: 'registration_enabled', value: 'true' });
        config.hosted.enabled = true;
        config.pricing.cloudOpen = false;
    });

    afterEach(() => {
        config.hosted.enabled = originalHosted;
        config.pricing.cloudOpen = originalCloudOpen;
    });

    it('closes registration while Cloud is shut, whatever the admin toggle says', async () => {
        const res = await request(app).get('/api/registration-status');
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(false);
        expect(res.body.waitlist).toBe(true);
    });

    it('refuses a registration attempt', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({
                email: `shut_${Date.now()}@example.com`,
                password: 'password123',
            });
        expect(res.status).toBe(404);
    });

    it('reopens with Cloud', async () => {
        config.pricing.cloudOpen = true;
        const res = await request(app).get('/api/registration-status');
        expect(res.body.enabled).toBe(true);
        expect(res.body.waitlist).toBe(false);
    });

    it('leaves a self-hosted instance alone', async () => {
        config.hosted.enabled = false;
        const res = await request(app).get('/api/registration-status');
        // Registration follows the admin toggle, and the generic "closed"
        // copy is used rather than the Cloud waitlist.
        expect(res.body.enabled).toBe(true);
        expect(res.body.waitlist).toBe(false);
    });

    it('stores an address left on the register page', async () => {
        const email = `app_${Date.now()}@example.com`;
        const res = await request(app)
            .post('/api/waitlist')
            .send({ email, locale: 'de' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ joined: true });

        const row = await WaitlistSubscriber.findOne({ where: { email } });
        expect(row).not.toBeNull();
        expect(row.source).toBe('app');
        expect(row.locale).toBe('de');
    });

    it('counts a second submission rather than refusing it', async () => {
        const email = `again_${Date.now()}@example.com`;
        await request(app).post('/api/waitlist').send({ email });
        const res = await request(app).post('/api/waitlist').send({ email });
        expect(res.status).toBe(200);

        const rows = await WaitlistSubscriber.findAll({ where: { email } });
        expect(rows).toHaveLength(1);
        expect(rows[0].submission_count).toBe(2);
    });

    it('answers the same way for an address it will not store', async () => {
        const res = await request(app)
            .post('/api/waitlist')
            .send({ email: 'not-an-address' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ joined: true });
        expect(
            await WaitlistSubscriber.count({
                where: { email: 'not-an-address' },
            })
        ).toBe(0);
    });

    it('normalizes the address it stores', async () => {
        const email = `MiXeD_${Date.now()}@Example.COM`;
        await request(app)
            .post('/api/waitlist')
            .send({ email: `  ${email} ` });

        const row = await WaitlistSubscriber.findOne({
            where: { email: email.toLowerCase() },
        });
        expect(row).not.toBeNull();
    });
});
