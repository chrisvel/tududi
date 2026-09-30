const request = require('supertest');
const app = require('../../app');
const { Setting, WaitlistSubscriber } = require('../../models');
const { getConfig } = require('../../config/config');

// Cloud is open, so on the app host registration follows the admin toggle
// alone and the register page has no address capture of its own. The
// release-notes signup lives on the marketing host (see landing.test.js).
describe('Registration on the hosted app host', () => {
    const config = getConfig();
    const originalHosted = config.hosted.enabled;

    beforeEach(async () => {
        await Setting.upsert({ key: 'registration_enabled', value: 'true' });
        config.hosted.enabled = true;
    });

    afterEach(() => {
        config.hosted.enabled = originalHosted;
    });

    it('is open when the admin toggle is on', async () => {
        const res = await request(app).get('/api/registration-status');
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(true);
        expect(res.body).not.toHaveProperty('waitlist');
    });

    it('closes with the admin toggle', async () => {
        await Setting.upsert({ key: 'registration_enabled', value: 'false' });
        const status = await request(app).get('/api/registration-status');
        expect(status.body.enabled).toBe(false);

        const res = await request(app)
            .post('/api/register')
            .send({
                email: `closed_${Date.now()}@tududi-test.dev`,
                password: 'password123',
            });
        expect(res.status).toBe(404);
    });

    it('ignores a leftover cloudOpen flag in the pricing config', async () => {
        config.pricing.cloudOpen = false;
        try {
            const res = await request(app).get('/api/registration-status');
            expect(res.body.enabled).toBe(true);
        } finally {
            delete config.pricing.cloudOpen;
        }
    });

    it('has no address capture on the app host', async () => {
        const email = `app_${Date.now()}@tududi-test.dev`;
        const res = await request(app).post('/api/waitlist').send({ email });
        // The route is gone, so it falls through to the auth wall.
        expect(res.status).toBe(401);
        expect(await WaitlistSubscriber.count({ where: { email } })).toBe(0);
    });
});
