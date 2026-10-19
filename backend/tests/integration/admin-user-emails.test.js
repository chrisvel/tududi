const request = require('supertest');
const app = require('../../app');
const {
    BillingAccount,
    EmailDelivery,
    Role,
    Task,
    User,
} = require('../../models');
const { getConfig } = require('../../config/config');
const entitlements = require('../../services/entitlementsService');
const emailService = require('../../services/emailService');
const lifecycle = require('../../services/trialLifecycleService');
const { createTestUser } = require('../helpers/testUtils');

jest.mock('../../services/emailService', () => ({
    ...jest.requireActual('../../services/emailService'),
    isEmailEnabled: jest.fn(() => true),
    sendEmail: jest.fn(async () => ({ success: true })),
}));

const config = getConfig();
const DAY = 24 * 60 * 60 * 1000;
let seq = 0;
const uniqueEmail = (p) => `${p}_${Date.now()}_${seq++}@example.com`;

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const entry = (body, key) => body.emails.find((e) => e.key === key);

// The admin's per-user email panel: what each user got, and sending one by
// hand after seeing exactly what it says.
describe('Admin user emails', () => {
    let admin, adminAgent;

    beforeEach(async () => {
        emailService.isEmailEnabled.mockReturnValue(true);
        emailService.sendEmail.mockClear();
        emailService.sendEmail.mockResolvedValue({ success: true });
        admin = await createTestUser({ email: uniqueEmail('adm') });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        adminAgent = await login(admin);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.requireSubscription = false;
        config.hosted.trialDays = 7;
        entitlements.invalidate();
    });

    it('is for admins only', async () => {
        const plain = await createTestUser({ email: uniqueEmail('plain') });
        const agent = await login(plain);
        const res = await agent.get(`/api/admin/users/${admin.id}/emails`);
        expect(res.status).toBe(403);
    });

    it('logs what the app sends on its own', async () => {
        const user = await createTestUser({
            email: uniqueEmail('reset'),
            language: 'de',
        });
        await request(app)
            .post('/api/forgot-password')
            .send({ email: user.email });

        const res = await adminAgent.get(`/api/admin/users/${user.id}/emails`);
        expect(res.status).toBe(200);
        expect(res.body.user.language).toBe('de');
        expect(entry(res.body, 'passwordReset').sent_count).toBe(1);
        expect(res.body.history[0]).toMatchObject({
            email: 'passwordReset',
            status: 'sent',
            language: 'de',
            sent_by: null,
        });
    });

    it('previews the exact email, then sends it and records who sent it', async () => {
        const user = await createTestUser({ email: uniqueEmail('target') });

        const preview = await adminAgent.get(
            `/api/admin/users/${user.id}/emails/passwordReset/preview`
        );
        expect(preview.status).toBe(200);
        expect(preview.body.to).toBe(user.email);
        expect(preview.body.subject).toBe('Reset your Tududi password');
        expect(preview.body.text).toContain(preview.body.link_placeholder);
        expect(emailService.sendEmail).not.toHaveBeenCalled();

        const sent = await adminAgent.post(
            `/api/admin/users/${user.id}/emails/passwordReset/send`
        );
        expect(sent.body).toEqual({ sent: true, error: null });
        const [mail] = emailService.sendEmail.mock.calls[0];
        expect(mail.subject).toBe(preview.body.subject);
        expect(mail.text).not.toContain(preview.body.link_placeholder);

        const row = await EmailDelivery.findOne({
            where: { user_id: user.id },
        });
        expect(row.triggered_by_user_id).toBe(admin.id);
        const res = await adminAgent.get(`/api/admin/users/${user.id}/emails`);
        expect(res.body.history[0].sent_by).toBe(admin.email);
    });

    it('records a failed send', async () => {
        const user = await createTestUser({ email: uniqueEmail('fail') });
        emailService.sendEmail.mockResolvedValue({
            success: false,
            reason: 'SMTP down',
        });
        const sent = await adminAgent.post(
            `/api/admin/users/${user.id}/emails/passwordReset/send`
        );
        expect(sent.body).toEqual({ sent: false, error: 'SMTP down' });
        const res = await adminAgent.get(`/api/admin/users/${user.id}/emails`);
        expect(entry(res.body, 'passwordReset')).toMatchObject({
            sent_count: 0,
            last_status: 'failed',
        });
    });

    it('says why an email does not apply and refuses to send it', async () => {
        const user = await createTestUser({ email: uniqueEmail('verified') });
        const res = await adminAgent.get(`/api/admin/users/${user.id}/emails`);
        expect(entry(res.body, 'verification')).toMatchObject({
            can_send: false,
            reason: 'The email address is already verified',
        });
        expect(entry(res.body, 'trialReminder')).toBeUndefined();

        const sent = await adminAgent.post(
            `/api/admin/users/${user.id}/emails/verification/send`
        );
        expect(sent.status).toBe(400);
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('refuses everything while email is not set up', async () => {
        emailService.isEmailEnabled.mockReturnValue(false);
        const user = await createTestUser({ email: uniqueEmail('noemail') });
        const res = await adminAgent.get(`/api/admin/users/${user.id}/emails`);
        expect(
            res.body.emails.every(
                (e) => e.reason === 'Email is not set up on this server'
            )
        ).toBe(true);
    });

    describe('on Cloud', () => {
        beforeEach(() => {
            config.hosted.enabled = true;
            config.hosted.requireSubscription = true;
            config.hosted.trialDays = 7;
            config.hosted.deleteExpiredTrials = true;
            entitlements.invalidate();
        });

        it('sends a trial reminder by hand and counts it as the daily one', async () => {
            const user = await createTestUser({ email: uniqueEmail('trial') });
            await entitlements.startTrial(user.id);
            await BillingAccount.update(
                { trial_ends_at: new Date(Date.now() + 2.5 * DAY) },
                { where: { user_id: user.id } }
            );
            entitlements.invalidate();

            const preview = await adminAgent.get(
                `/api/admin/users/${user.id}/emails/trialReminder/preview`
            );
            expect(preview.body.subject).toBe(
                'Your tududi trial ends in 3 days'
            );

            const sent = await adminAgent.post(
                `/api/admin/users/${user.id}/emails/trialReminder/send`
            );
            expect(sent.body.sent).toBe(true);
            expect(await lifecycle.remindEndingTrials()).toEqual([]);
        });

        it('offers the empty account email until they make something, then the come back one', async () => {
            const user = await createTestUser({ email: uniqueEmail('new') });
            await entitlements.startTrial(user.id);
            entitlements.invalidate();

            let res = await adminAgent.get(
                `/api/admin/users/${user.id}/emails`
            );
            expect(entry(res.body, 'emptyAccount').can_send).toBe(true);
            expect(entry(res.body, 'comeBack').can_send).toBe(false);

            const preview = await adminAgent.get(
                `/api/admin/users/${user.id}/emails/emptyAccount/preview`
            );
            expect(preview.body.subject).toBe('Your tududi is still empty');
            expect(preview.body.text).toContain('Your free trial runs until');

            await Task.create({ name: 'First', user_id: user.id });
            res = await adminAgent.get(`/api/admin/users/${user.id}/emails`);
            expect(entry(res.body, 'emptyAccount').can_send).toBe(false);
            expect(entry(res.body, 'comeBack').can_send).toBe(true);

            const sent = await adminAgent.post(
                `/api/admin/users/${user.id}/emails/comeBack/send`
            );
            expect(sent.body.sent).toBe(true);

            res = await adminAgent.get(`/api/admin/users/${user.id}/emails`);
            expect(entry(res.body, 'comeBack').can_send).toBe(false);
            const again = await adminAgent.post(
                `/api/admin/users/${user.id}/emails/comeBack/send`
            );
            expect(again.status).toBe(400);
        });

        it('sends the empty account email by hand only once', async () => {
            const user = await createTestUser({ email: uniqueEmail('once') });
            const first = await adminAgent.post(
                `/api/admin/users/${user.id}/emails/emptyAccount/send`
            );
            expect(first.body.sent).toBe(true);

            const res = await adminAgent.get(
                `/api/admin/users/${user.id}/emails`
            );
            expect(entry(res.body, 'emptyAccount').reason).toBe(
                'Already sent; it goes out once'
            );
            const again = await adminAgent.post(
                `/api/admin/users/${user.id}/emails/emptyAccount/send`
            );
            expect(again.status).toBe(400);
        });

        it('warns before deletion only where deletion is on, and says what sending does', async () => {
            const user = await createTestUser({ email: uniqueEmail('ended') });
            await entitlements.startTrial(user.id);
            await BillingAccount.update(
                {
                    trial_started_at: new Date(Date.now() - 20 * DAY),
                    trial_ends_at: new Date(Date.now() - 10 * DAY),
                },
                { where: { user_id: user.id } }
            );
            entitlements.invalidate();

            const preview = await adminAgent.get(
                `/api/admin/users/${user.id}/emails/deletionWarning/preview`
            );
            expect(preview.body.note).toMatch(
                /^Sending sets the deletion date/
            );

            config.hosted.deleteExpiredTrials = false;
            const res = await adminAgent.get(
                `/api/admin/users/${user.id}/emails`
            );
            expect(entry(res.body, 'deletionWarning').can_send).toBe(false);
            const account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.deletion_warned_at).toBeNull();
            expect(await User.findByPk(user.id)).not.toBeNull();
        });
    });

    it('counts sent emails in the user list', async () => {
        const user = await createTestUser({ email: uniqueEmail('count') });
        await adminAgent.post(
            `/api/admin/users/${user.id}/emails/passwordReset/send`
        );
        const res = await adminAgent.get('/api/admin/overview/users');
        const row = res.body.users.find((u) => u.id === user.id);
        expect(row.emails_sent).toBe(1);
    });
});
