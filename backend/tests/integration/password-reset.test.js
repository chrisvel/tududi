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
const { User, AuthAuditLog } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { hashToken } = require('../../modules/auth/passwordResetService');
const { authEmailKey } = require('../../middleware/rateLimiter');

const linkFromLastEmail = () => {
    const last = sentEmails[sentEmails.length - 1];
    const match = last.text.match(/token=([a-f0-9]+)/);
    return match ? match[1] : null;
};

describe('Password reset', () => {
    let user;

    beforeEach(async () => {
        sentEmails.length = 0;
        user = await createTestUser({
            email: `reset_${Date.now()}@example.com`,
        });
    });

    it('answers identically for known and unknown emails', async () => {
        const known = await request(app)
            .post('/api/forgot-password')
            .send({ email: user.email });
        const unknown = await request(app)
            .post('/api/forgot-password')
            .send({ email: `nobody_${Date.now()}@example.com` });

        expect(known.status).toBe(200);
        expect(unknown.status).toBe(200);
        expect(known.body).toEqual(unknown.body);
        expect(sentEmails).toHaveLength(1);
        expect(sentEmails[0].to).toBe(user.email);
    });

    it('stores only a hash of the token and emails the raw one', async () => {
        await request(app)
            .post('/api/forgot-password')
            .send({ email: user.email.toUpperCase() });

        const token = linkFromLastEmail();
        expect(token).toHaveLength(64);

        await user.reload();
        expect(user.password_reset_token_hash).toBe(hashToken(token));
        expect(user.password_reset_token_hash).not.toBe(token);
        expect(user.password_reset_token_expires_at.getTime()).toBeGreaterThan(
            Date.now()
        );
    });

    it('sets a new password, clears the token, and signs out other sessions', async () => {
        const oldSession = request.agent(app);
        await oldSession
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        const before = await oldSession.get('/api/current_user');
        expect(before.body.user.email).toBe(user.email);

        await request(app)
            .post('/api/forgot-password')
            .send({ email: user.email });
        const token = linkFromLastEmail();

        const reset = await request(app)
            .post('/api/reset-password')
            .send({ token, password: 'brand-new-pass' });
        expect(reset.status).toBe(200);

        await user.reload();
        expect(user.password_reset_token_hash).toBeNull();
        expect(user.password_reset_token_expires_at).toBeNull();

        const after = await oldSession.get('/api/current_user');
        expect(after.body.user).toBeNull();

        const oldLogin = await request(app)
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        expect(oldLogin.status).toBe(401);

        const newLogin = await request(app)
            .post('/api/login')
            .send({ email: user.email, password: 'brand-new-pass' });
        expect(newLogin.status).toBe(200);

        const audit = await AuthAuditLog.findOne({
            where: { event_type: 'password_reset' },
            order: [['id', 'DESC']],
        });
        expect(audit).not.toBeNull();
    });

    it('rejects a token twice, an expired token, and a made-up token', async () => {
        await request(app)
            .post('/api/forgot-password')
            .send({ email: user.email });
        const token = linkFromLastEmail();

        await request(app)
            .post('/api/reset-password')
            .send({ token, password: 'first-new-pass' });
        const again = await request(app)
            .post('/api/reset-password')
            .send({ token, password: 'second-new-pass' });
        expect(again.status).toBe(400);

        await request(app)
            .post('/api/forgot-password')
            .send({ email: user.email });
        const expiredToken = linkFromLastEmail();
        await user.update({
            password_reset_token_expires_at: new Date(Date.now() - 1000),
        });
        const expired = await request(app)
            .post('/api/reset-password')
            .send({ token: expiredToken, password: 'another-new-pass' });
        expect(expired.status).toBe(400);

        const bogus = await request(app)
            .post('/api/reset-password')
            .send({ token: 'a'.repeat(64), password: 'another-new-pass' });
        expect(bogus.status).toBe(400);
    });

    it('enforces the password policy on reset', async () => {
        await request(app)
            .post('/api/forgot-password')
            .send({ email: user.email });
        const token = linkFromLastEmail();

        const short = await request(app)
            .post('/api/reset-password')
            .send({ token, password: 'short7c' });
        expect(short.status).toBe(400);
        expect(short.body.error).toMatch(/at least 8 characters/);

        await user.reload();
        expect(user.password_reset_token_hash).not.toBeNull();
    });

    it('lets a passwordless (SSO) account set a password through reset', async () => {
        const ssoUser = await User.create({
            email: `sso_${Date.now()}@example.com`,
            password_digest: null,
        });

        await request(app)
            .post('/api/forgot-password')
            .send({ email: ssoUser.email });
        const token = linkFromLastEmail();
        const reset = await request(app)
            .post('/api/reset-password')
            .send({ token, password: 'sso-new-pass' });
        expect(reset.status).toBe(200);

        const login = await request(app)
            .post('/api/login')
            .send({ email: ssoUser.email, password: 'sso-new-pass' });
        expect(login.status).toBe(200);
    });
});

describe('Password login audit trail', () => {
    it('records successes and failures', async () => {
        const user = await createTestUser({
            email: `audit_${Date.now()}@example.com`,
        });

        await request(app)
            .post('/api/login')
            .send({ email: user.email, password: 'wrong-password' });
        await request(app)
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });

        const failed = await AuthAuditLog.findOne({
            where: {
                event_type: 'login_failed',
                auth_method: 'email_password',
            },
            order: [['id', 'DESC']],
        });
        expect(failed).not.toBeNull();
        expect(JSON.parse(failed.metadata).email).toBe(user.email);

        const success = await AuthAuditLog.findOne({
            where: {
                event_type: 'login_success',
                auth_method: 'email_password',
                user_id: user.id,
            },
        });
        expect(success).not.toBeNull();
    });
});

describe('Email-keyed auth limiter key', () => {
    it('keys by normalised email and falls back to the IP', () => {
        const withEmail = {
            body: { email: '  Someone@Example.COM ' },
            ip: '1.2.3.4',
        };
        expect(authEmailKey(withEmail)).toBe('email:someone@example.com');

        const noEmail = { body: {}, ip: '1.2.3.4' };
        expect(authEmailKey(noEmail)).toBe('1.2.3.4');
    });
});
