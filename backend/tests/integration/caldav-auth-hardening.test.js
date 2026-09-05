const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const basic = (email, password) =>
    `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;

describe('CalDAV Basic auth hardening', () => {
    it('rejects a passwordless (SSO) account with 401, not 500', async () => {
        const sso = await User.create({
            email: `caldav_sso_${Date.now()}@example.com`,
            password_digest: null,
        });

        const res = await request(app)
            .propfind(`/caldav/${sso.email}/`)
            .set('Authorization', basic(sso.email, 'anything'))
            .set('Content-Type', 'application/xml')
            .send('<?xml version="1.0"?><D:propfind xmlns:D="DAV:"/>');

        expect(res.status).toBe(401);
    });

    it('matches the username case-insensitively', async () => {
        const user = await createTestUser({
            email: `caldav_case_${Date.now()}@example.com`,
        });

        const res = await request(app)
            .options(`/caldav/${user.email}/`)
            .set(
                'Authorization',
                basic(user.email.toUpperCase(), 'password123')
            );

        expect([200, 204]).toContain(res.status);
    });
});

describe('CalDAV feature flag', () => {
    let previous;

    beforeEach(() => {
        previous = process.env.FF_ENABLE_CALDAV;
        process.env.FF_ENABLE_CALDAV = 'false';
        delete process.env.CALDAV_ENABLED;
    });

    afterEach(() => {
        process.env.FF_ENABLE_CALDAV = previous;
    });

    it('hides the protocol endpoints when CalDAV is off', async () => {
        const user = await createTestUser({
            email: `caldav_off_${Date.now()}@example.com`,
        });

        const wellKnown = await request(app).get('/.well-known/caldav');
        expect(wellKnown.status).toBe(404);

        const calendar = await request(app)
            .options(`/caldav/${user.email}/`)
            .set('Authorization', basic(user.email, 'password123'));
        expect(calendar.status).toBe(404);

        const flags = await request(app).get('/api/feature-flags');
        expect(flags.body.featureFlags.caldav).toBe(false);
    });

    it('leaves the rest of the app alone', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
    });
});
