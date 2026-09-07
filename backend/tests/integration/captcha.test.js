const request = require('supertest');

const sentEmails = [];
jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async (message) => {
        sentEmails.push(message);
        return { success: true, messageId: 'test' };
    },
}));

const app = require('../../app');
const { getConfig } = require('../../config/config');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();
const realFetch = global.fetch;

// Stands in for Cloudflare's siteverify: "good" passes, anything else fails
const verify = { calls: [], outage: false };
function mockFetch(url, options = {}) {
    verify.calls.push({ url: String(url), body: String(options.body) });
    if (verify.outage) return Promise.reject(new Error('cloudflare down'));
    const token = new URLSearchParams(String(options.body)).get('response');
    return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: token === 'good' }),
    });
}

describe('Captcha on public forms', () => {
    let user;

    beforeEach(async () => {
        sentEmails.length = 0;
        verify.calls = [];
        verify.outage = false;
        user = await createTestUser({
            email: `captcha_${Date.now()}@example.com`,
        });
    });

    describe('when not configured', () => {
        it('leaves the forms alone and exposes no site key', async () => {
            const cfg = await request(app).get('/api/config');
            expect(cfg.body.captcha).toBeNull();
            const res = await request(app)
                .post('/api/forgot-password')
                .send({ email: user.email });
            expect(res.status).toBe(200);
            expect(sentEmails).toHaveLength(1);
        });
    });

    describe('when configured', () => {
        beforeEach(() => {
            global.fetch = mockFetch;
            config.captcha.siteKey = '1x00000000000000000000AA';
            config.captcha.secretKey = '1x0000000000000000000000000000000AA';
        });

        afterEach(() => {
            global.fetch = realFetch;
            config.captcha.siteKey = undefined;
            config.captcha.secretKey = undefined;
        });

        it('publishes the site key, never the secret', async () => {
            const cfg = await request(app).get('/api/config');
            expect(cfg.body.captcha).toEqual({
                provider: 'turnstile',
                site_key: '1x00000000000000000000AA',
            });
            expect(JSON.stringify(cfg.body)).not.toContain(
                '1x0000000000000000000000000000000AA'
            );
        });

        it('rejects a password reset without a token and sends nothing', async () => {
            const res = await request(app)
                .post('/api/forgot-password')
                .send({ email: user.email });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('CAPTCHA_FAILED');
            expect(sentEmails).toHaveLength(0);
            expect(verify.calls).toHaveLength(0);
        });

        it('rejects a bad token and accepts a good one, verified with Cloudflare', async () => {
            const bad = await request(app)
                .post('/api/forgot-password')
                .send({ email: user.email, captcha_token: 'bad' });
            expect(bad.status).toBe(400);
            expect(bad.body.code).toBe('CAPTCHA_FAILED');
            expect(sentEmails).toHaveLength(0);

            const good = await request(app)
                .post('/api/forgot-password')
                .send({ email: user.email, captcha_token: 'good' });
            expect(good.status).toBe(200);
            expect(sentEmails).toHaveLength(1);
            expect(verify.calls[1].url).toContain('turnstile/v0/siteverify');
            expect(verify.calls[1].body).toContain('response=good');
        });

        it('guards registration and verification resend too', async () => {
            const reg = await request(app)
                .post('/api/register')
                .send({
                    email: `new_${Date.now()}@example.com`,
                    password: 'password123',
                });
            expect(reg.status).toBe(400);
            expect(reg.body.code).toBe('CAPTCHA_FAILED');

            const resend = await request(app)
                .post('/api/resend-verification')
                .set('x-captcha-token', 'bad')
                .send({ email: user.email });
            expect(resend.status).toBe(400);
            expect(resend.body.code).toBe('CAPTCHA_FAILED');
        });

        it('lets a request through when Cloudflare itself is unreachable', async () => {
            verify.outage = true;
            const res = await request(app)
                .post('/api/forgot-password')
                .send({ email: user.email, captcha_token: 'good' });
            expect(res.status).toBe(200);
            expect(sentEmails).toHaveLength(1);
        });
    });
});
