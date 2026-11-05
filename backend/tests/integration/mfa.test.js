process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'mfa-test-session-secret';

const request = require('supertest');

jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async () => ({ success: true, messageId: 'test' }),
}));

const app = require('../../app');
const { getConfig } = require('../../config/config');
const {
    UserMfa,
    UserRecoveryCode,
    AuthAuditLog,
    EmailDelivery,
    Role,
} = require('../../models');
const totp = require('../../modules/mfa/totp');
const mfaSession = require('../../modules/mfa/session');
const { createTestUser } = require('../helpers/testUtils');

const PASSWORD = 'password123';

const signIn = async (user) => {
    const agent = request.agent(app);
    const res = await agent
        .post('/api/login')
        .send({ email: user.email, password: PASSWORD });
    return { agent, res };
};

// A code the server has not seen yet. Each accepted code moves
// last_used_step on, so tests that sign in more than once clear it first.
const codeNow = (secret) => totp.codeAt(secret, totp.stepAt(Date.now()));
const freshCode = async (user, secret) => {
    await UserMfa.update(
        { last_used_step: null },
        { where: { user_id: user.id } }
    );
    return codeNow(secret);
};

// Turns 2FA on through the API; returns the secret and the recovery codes.
const enableMfa = async (agent) => {
    const setup = await agent.post('/api/profile/mfa/setup');
    expect(setup.status).toBe(200);
    const enable = await agent
        .post('/api/profile/mfa/enable')
        .send({ code: codeNow(setup.body.secret) });
    expect(enable.status).toBe(200);
    return {
        secret: setup.body.secret,
        recoveryCodes: enable.body.recovery_codes,
    };
};

const waitFor = async (check) => {
    for (let i = 0; i < 50; i++) {
        if (await check()) return true;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
};

describe('Two-factor sign-in', () => {
    let user;

    beforeEach(async () => {
        user = await createTestUser({
            email: `mfa_${Date.now()}_${Math.random()}@example.com`,
            email_verified: true,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('turning it on', () => {
        it('confirms a code, hands out 10 recovery codes and signs out other devices', async () => {
            const { agent } = await signIn(user);
            const { agent: other } = await signIn(user);
            expect((await other.get('/api/profile')).status).toBe(200);

            const { recoveryCodes } = await enableMfa(agent);

            expect(recoveryCodes).toHaveLength(10);
            recoveryCodes.forEach((code) =>
                expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/)
            );
            const status = await agent.get('/api/profile/mfa');
            expect(status.body).toMatchObject({
                enabled: true,
                recovery_codes_left: 10,
            });
            expect((await agent.get('/api/profile')).status).toBe(200);
            expect((await other.get('/api/profile')).status).toBe(401);

            const row = await UserMfa.findOne({ where: { user_id: user.id } });
            expect(row.secret_encrypted).toMatch(/^enc:v1:/);
            expect(
                await waitFor(async () =>
                    EmailDelivery.findOne({
                        where: {
                            user_id: user.id,
                            email: 'securityNotice',
                            variant: 'mfaEnabled',
                        },
                    })
                )
            ).toBe(true);
        });

        it('keeps nothing when setup is never confirmed', async () => {
            const { agent } = await signIn(user);
            await agent.post('/api/profile/mfa/setup');

            const wrong = await agent
                .post('/api/profile/mfa/enable')
                .send({ code: '000000' });

            expect(wrong.status).toBe(400);
            expect(await UserMfa.count({ where: { user_id: user.id } })).toBe(
                0
            );
        });

        it('needs server key material', async () => {
            const { agent } = await signIn(user);
            jest.replaceProperty(process, 'env', {
                ...process.env,
                TUDUDI_SESSION_SECRET: '',
                TUDUDI_OIDC_SECRET_ENCRYPTION_KEY: '',
            });

            const res = await agent.post('/api/profile/mfa/setup');

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/TUDUDI_SESSION_SECRET/);
        });
    });

    describe('signing in', () => {
        let secret;
        let recoveryCodes;

        beforeEach(async () => {
            const { agent } = await signIn(user);
            ({ secret, recoveryCodes } = await enableMfa(agent));
        });

        it('stops at the code prompt after the password', async () => {
            const { agent, res } = await signIn(user);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ mfa_required: true });
            expect((await agent.get('/api/profile')).status).toBe(401);
            const current = await agent.get('/api/current_user');
            expect(current.body).toMatchObject({
                user: null,
                mfa_pending: true,
            });

            const done = await agent
                .post('/api/login/mfa')
                .send({ code: await freshCode(user, secret) });

            expect(done.status).toBe(200);
            expect(done.body.user.email).toBe(user.email);
            expect((await agent.get('/api/profile')).status).toBe(200);
        });

        it('drops the half sign-in after 5 wrong codes', async () => {
            const { agent } = await signIn(user);
            for (let i = 0; i < 5; i++) {
                const res = await agent
                    .post('/api/login/mfa')
                    .send({ code: '000000' });
                expect(res.status).toBe(401);
            }

            const res = await agent
                .post('/api/login/mfa')
                .send({ code: await freshCode(user, secret) });

            expect(res.status).toBe(401);
            expect(res.body.mfa_expired).toBe(true);
        });

        it('drops the half sign-in after 5 minutes', async () => {
            const { agent } = await signIn(user);
            const later = Date.now() + mfaSession.PENDING_TTL_MS + 1000;
            const code = await freshCode(user, secret);
            jest.spyOn(Date, 'now').mockReturnValue(later);

            const res = await agent.post('/api/login/mfa').send({ code });

            expect(res.status).toBe(401);
            expect(res.body.mfa_expired).toBe(true);
        });

        it('never takes the same code twice', async () => {
            const code = await freshCode(user, secret);
            const first = await signIn(user);
            expect(
                (await first.agent.post('/api/login/mfa').send({ code })).status
            ).toBe(200);

            const second = await signIn(user);
            const replay = await second.agent
                .post('/api/login/mfa')
                .send({ code });

            expect(replay.status).toBe(401);
        });

        it('takes each recovery code once', async () => {
            const [code] = recoveryCodes;
            const first = await signIn(user);
            const used = await first.agent
                .post('/api/login/mfa')
                .send({ recovery_code: code.toUpperCase().replace('-', ' ') });
            expect(used.status).toBe(200);

            const second = await signIn(user);
            const again = await second.agent
                .post('/api/login/mfa')
                .send({ recovery_code: code });

            expect(again.status).toBe(401);
            expect(
                await UserRecoveryCode.count({
                    where: { user_id: user.id, used_at: null },
                })
            ).toBe(9);
        });

        it('locks the account for codes after 10 misses, across sign-ins', async () => {
            for (let attempt = 0; attempt < 2; attempt++) {
                const { agent } = await signIn(user);
                for (let i = 0; i < 5; i++) {
                    await agent.post('/api/login/mfa').send({ code: '000000' });
                }
            }

            const { agent } = await signIn(user);
            const res = await agent
                .post('/api/login/mfa')
                .send({ code: await freshCode(user, secret) });

            expect(res.status).toBe(429);
            expect(
                await AuthAuditLog.count({
                    where: { user_id: user.id, event_type: 'mfa_failed' },
                })
            ).toBe(10);
        });

        it('refuses the password alone for CalDAV, but takes an API token', async () => {
            const basic = (secretValue) =>
                `Basic ${Buffer.from(`${user.email}:${secretValue}`).toString('base64')}`;

            const withPassword = await request(app)
                .propfind(`/caldav/${user.email}/`)
                .set('Authorization', basic(PASSWORD));
            expect(withPassword.status).toBe(401);

            const { agent } = await signIn(user);
            await agent
                .post('/api/login/mfa')
                .send({ code: await freshCode(user, secret) });
            const created = await agent
                .post('/api/profile/api-keys')
                .send({ name: 'Calendar' });
            expect(created.status).toBe(201);

            const withToken = await request(app)
                .propfind(`/caldav/${user.email}/`)
                .set('Authorization', basic(created.body.token));
            expect(withToken.status).not.toBe(401);
        });
    });

    describe('step-up', () => {
        it('asks for the password again to create an API token after 10 minutes', async () => {
            const { agent } = await signIn(user);
            const later = Date.now() + mfaSession.RECENT_AUTH_MS + 1000;
            jest.spyOn(Date, 'now').mockReturnValue(later);

            const refused = await agent
                .post('/api/profile/api-keys')
                .send({ name: 'Later' });
            expect(refused.status).toBe(403);
            expect(refused.body).toMatchObject({
                reauth_required: true,
                method: 'password',
            });

            const wrong = await agent
                .post('/api/auth/reverify')
                .send({ password: 'not-it' });
            expect(wrong.status).toBe(400);

            await agent.post('/api/auth/reverify').send({ password: PASSWORD });
            const created = await agent
                .post('/api/profile/api-keys')
                .send({ name: 'Later' });
            expect(created.status).toBe(201);
        });

        it('asks for a code, not the password, when 2FA is on', async () => {
            const { agent } = await signIn(user);
            const { secret } = await enableMfa(agent);
            const later = Date.now() + mfaSession.RECENT_AUTH_MS + 1000;
            await freshCode(user, secret);
            jest.spyOn(Date, 'now').mockReturnValue(later);

            const refused = await agent
                .post('/api/profile/mfa/recovery-codes')
                .send();
            expect(refused.body.method).toBe('code');

            expect(
                (
                    await agent
                        .post('/api/auth/reverify')
                        .send({ password: PASSWORD })
                ).status
            ).toBe(400);

            const verified = await agent
                .post('/api/auth/reverify')
                .send({ code: totp.codeAt(secret, totp.stepAt(later)) });
            expect(verified.status).toBe(200);
            const codes = await agent.post('/api/profile/mfa/recovery-codes');
            expect(codes.status).toBe(200);
            expect(codes.body.recovery_codes).toHaveLength(10);
        });

        it('turns 2FA off only with a fresh code, even right after sign-in', async () => {
            const { agent } = await signIn(user);
            const { secret } = await enableMfa(agent);

            const bare = await agent.post('/api/profile/mfa/disable').send({});
            expect(bare.status).toBe(400);
            expect((await agent.get('/api/profile')).status).toBe(200);

            const off = await agent
                .post('/api/profile/mfa/disable')
                .send({ code: await freshCode(user, secret) });
            expect(off.status).toBe(200);
            expect(await UserMfa.count({ where: { user_id: user.id } })).toBe(
                0
            );
            expect((await signIn(user)).res.body.user.email).toBe(user.email);
        });
    });

    describe('password change', () => {
        it('signs out every other device and keeps this one', async () => {
            const { agent } = await signIn(user);
            const { agent: other } = await signIn(user);

            const res = await agent
                .post('/api/profile/change-password')
                .send({ currentPassword: PASSWORD, newPassword: 'newpass456' });

            expect(res.status).toBe(200);
            expect((await agent.get('/api/profile')).status).toBe(200);
            expect((await other.get('/api/profile')).status).toBe(401);
        });
    });

    describe('admin reset', () => {
        let admin;
        let adminAgent;

        beforeEach(async () => {
            admin = await createTestUser({
                email: `mfa_admin_${Date.now()}@example.com`,
                email_verified: true,
            });
            // The first account made is the admin; make it a plain user.
            await Role.destroy({ where: { user_id: [user.id, admin.id] } });
            await Role.create({ user_id: user.id, is_admin: false });
            await Role.create({ user_id: admin.id, is_admin: true });
            ({ agent: adminAgent } = await signIn(admin));
        });

        it('clears 2FA for a locked-out user, shows it in the user list and logs it', async () => {
            const { agent } = await signIn(user);
            await enableMfa(agent);

            const list = await adminAgent.get('/api/admin/users');
            expect(list.body.find((u) => u.id === user.id).mfa_enabled).toBe(
                true
            );

            const res = await adminAgent.post(
                `/api/admin/users/${user.id}/mfa/reset`
            );

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ reset: true });
            expect((await agent.get('/api/profile')).status).toBe(401);
            expect((await signIn(user)).res.body.user.email).toBe(user.email);
            const event = await AuthAuditLog.findOne({
                where: { user_id: user.id, event_type: 'mfa_reset' },
            });
            expect(JSON.parse(event.metadata)).toEqual({ reset_by: admin.id });
        });

        it('refuses a reset of your own 2FA', async () => {
            const res = await adminAgent.post(
                `/api/admin/users/${admin.id}/mfa/reset`
            );
            expect(res.status).toBe(403);
        });

        it('refuses a user who is not an admin', async () => {
            const { agent } = await signIn(user);
            const res = await agent.post(
                `/api/admin/users/${admin.id}/mfa/reset`
            );
            expect(res.status).toBe(403);
        });
    });

    describe('superadmin on a hosted instance', () => {
        const config = getConfig();
        let admin;

        beforeEach(async () => {
            admin = await createTestUser({
                email: `mfa_super_${Date.now()}@example.com`,
                email_verified: true,
            });
            await Role.destroy({ where: { user_id: admin.id } });
            await Role.create({ user_id: admin.id, is_admin: true });
        });

        afterEach(() => {
            config.hosted.enabled = false;
        });

        it('keeps the admin panel closed until 2FA is on', async () => {
            const { agent } = await signIn(admin);
            config.hosted.enabled = true;

            const closed = await agent.get('/api/admin/users');
            expect(closed.status).toBe(403);
            expect(closed.body.mfa_setup_required).toBe(true);
            expect((await agent.get('/api/profile')).status).toBe(200);

            await enableMfa(agent);
            expect((await agent.get('/api/admin/users')).status).toBe(200);
        });

        it('leaves a self-hosted admin alone', async () => {
            const { agent } = await signIn(admin);
            expect((await agent.get('/api/admin/users')).status).toBe(200);
        });
    });
});
