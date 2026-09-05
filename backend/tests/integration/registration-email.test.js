const request = require('supertest');

let mockEmailEnabled = true;
const mockSentEmails = [];
jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => mockEmailEnabled,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async (message) => {
        mockSentEmails.push(message);
        return { success: true, messageId: 'test' };
    },
}));

const app = require('../../app');
const { User, Setting } = require('../../models');

describe('Registration when email cannot be sent', () => {
    beforeEach(async () => {
        mockSentEmails.length = 0;
        mockEmailEnabled = true;
        await Setting.upsert({ key: 'registration_enabled', value: 'true' });
    });

    it('answers 503 and keeps no account when the email service is off', async () => {
        mockEmailEnabled = false;
        const email = `noemail_${Date.now()}@example.com`;

        const res = await request(app)
            .post('/api/register')
            .send({ email, password: 'password123' });

        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/temporarily unavailable/);
        expect(await User.findOne({ where: { email } })).toBeNull();
    });

    it('registers normally when email works', async () => {
        const email = `ok_${Date.now()}@example.com`;

        const res = await request(app)
            .post('/api/register')
            .send({ email, password: 'password123' });

        expect(res.status).toBe(201);
        expect(mockSentEmails).toHaveLength(1);
    });
});

describe('POST /api/resend-verification', () => {
    beforeEach(async () => {
        mockSentEmails.length = 0;
        mockEmailEnabled = true;
        await Setting.upsert({ key: 'registration_enabled', value: 'true' });
    });

    it('issues a new token for an unverified account', async () => {
        const email = `pending_${Date.now()}@example.com`;
        await request(app)
            .post('/api/register')
            .send({ email, password: 'password123' });
        const before = await User.findOne({ where: { email } });
        const oldToken = before.email_verification_token;

        const res = await request(app)
            .post('/api/resend-verification')
            .send({ email: email.toUpperCase() });

        expect(res.status).toBe(200);
        expect(mockSentEmails).toHaveLength(2);
        await before.reload();
        expect(before.email_verification_token).not.toBe(oldToken);
        expect(mockSentEmails[1].text).toContain(
            before.email_verification_token
        );
    });

    it('responds identically for verified and unknown addresses without sending', async () => {
        const verified = await User.create({
            email: `verified_${Date.now()}@example.com`,
            password: 'password123',
            email_verified: true,
        });

        const known = await request(app)
            .post('/api/resend-verification')
            .send({ email: verified.email });
        const unknown = await request(app)
            .post('/api/resend-verification')
            .send({ email: `ghost_${Date.now()}@example.com` });

        expect(known.status).toBe(200);
        expect(unknown.status).toBe(200);
        expect(known.body).toEqual(unknown.body);
        expect(mockSentEmails).toHaveLength(0);
    });
});
