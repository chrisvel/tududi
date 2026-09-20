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
const { User, Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const loginAgent = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

const tokenFromLastEmail = () => {
    const last = sentEmails[sentEmails.length - 1];
    const match = last.text.match(/token=([a-f0-9]+)/);
    return match ? match[1] : null;
};

describe('Admin member invite', () => {
    let adminAgent;

    beforeEach(async () => {
        sentEmails.length = 0;
        const admin = await createTestUser({
            email: `admin_${Date.now()}@example.com`,
        });
        await Role.destroy({ where: {} });
        await Role.findOrCreate({
            where: { user_id: admin.id },
            defaults: { user_id: admin.id, is_admin: true },
        });
        adminAgent = await loginAgent(admin.email);
    });

    it('creates an inert account and emails a set-password link when no password is given', async () => {
        const email = `member_${Date.now()}@example.com`;
        const res = await adminAgent
            .post('/api/admin/users')
            .send({ email, name: 'Member' });

        expect(res.status).toBe(201);
        expect(res.body.invited).toBe(true);
        expect(res.body.email_sent).toBe(true);

        const created = await User.findOne({ where: { email } });
        expect(created.email_verified).toBe(false);
        expect(created.password_digest).toBeNull();

        expect(sentEmails).toHaveLength(1);
        expect(sentEmails[0].to).toBe(email);
        expect(tokenFromLastEmail()).toBeTruthy();
    });

    it('lets the invited member set a password with the emailed token and then log in', async () => {
        const email = `member2_${Date.now()}@example.com`;
        await adminAgent.post('/api/admin/users').send({ email });

        const token = tokenFromLastEmail();
        const reset = await request(app)
            .post('/api/reset-password')
            .send({ token, password: 'newpassword123' });
        expect(reset.status).toBe(200);

        const login = await request(app)
            .post('/api/login')
            .send({ email, password: 'newpassword123' });
        expect(login.status).toBe(200);

        const user = await User.findOne({ where: { email } });
        expect(user.email_verified).toBe(true);
    });

    it('still creates the account normally when a password is supplied', async () => {
        const email = `member3_${Date.now()}@example.com`;
        const res = await adminAgent
            .post('/api/admin/users')
            .send({ email, password: 'password123' });

        expect(res.status).toBe(201);
        expect(res.body.invited).toBe(false);
        expect(sentEmails).toHaveLength(0);

        const login = await request(app)
            .post('/api/login')
            .send({ email, password: 'password123' });
        expect(login.status).toBe(200);
    });

    describe('require_verification', () => {
        it('creates an unverified account and emails a verification link', async () => {
            const email = `verify_${Date.now()}@example.com`;
            const res = await adminAgent.post('/api/admin/users').send({
                email,
                password: 'password123',
                require_verification: true,
            });

            expect(res.status).toBe(201);
            expect(res.body.invited).toBe(false);
            expect(res.body.verification_requested).toBe(true);
            expect(res.body.email_sent).toBe(true);

            const created = await User.findOne({ where: { email } });
            expect(created.email_verified).toBe(false);
            expect(created.email_verification_token).toBeTruthy();

            expect(sentEmails).toHaveLength(1);
            expect(sentEmails[0].to).toBe(email);
            expect(sentEmails[0].text).toContain('/api/verify-email?token=');

            const blocked = await request(app)
                .post('/api/login')
                .send({ email, password: 'password123' });
            expect(blocked.status).toBe(403);

            const token = tokenFromLastEmail();
            const verified = await request(app).get(
                `/api/verify-email?token=${token}`
            );
            expect(verified.status).toBeLessThan(400);

            const login = await request(app)
                .post('/api/login')
                .send({ email, password: 'password123' });
            expect(login.status).toBe(200);
        });

        it('leaves the account verified when the switch is off', async () => {
            const email = `noverify_${Date.now()}@example.com`;
            const res = await adminAgent.post('/api/admin/users').send({
                email,
                password: 'password123',
                require_verification: false,
            });

            expect(res.status).toBe(201);
            expect(res.body.verification_requested).toBe(false);
            expect(sentEmails).toHaveLength(0);

            const created = await User.findOne({ where: { email } });
            expect(created.email_verified).toBe(true);
        });

        it('sends only the invitation when no password is given', async () => {
            const email = `invitever_${Date.now()}@example.com`;
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email, require_verification: true });

            expect(res.status).toBe(201);
            expect(res.body.invited).toBe(true);
            expect(res.body.verification_requested).toBe(false);
            expect(sentEmails).toHaveLength(1);
        });

        it('rejects a non-boolean require_verification', async () => {
            const res = await adminAgent.post('/api/admin/users').send({
                email: `bad_${Date.now()}@example.com`,
                password: 'password123',
                require_verification: 'yes',
            });

            expect(res.status).toBe(400);
        });
    });
});
