'use strict';

const request = require('supertest');
const { OIDCIdentity, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// The identity provider is replaced by a fake client; everything else in the
// flow (state storage, binding cookie, session handling, provisioning) is real.
jest.mock('openid-client', () => {
    const actual = jest.requireActual('openid-client');
    return {
        generators: actual.generators,
        Issuer: { discover: jest.fn() },
        __client: {
            authorizationUrl: jest.fn(),
            callback: jest.fn(),
            userinfo: jest.fn(),
        },
    };
});

const { Issuer, __client: idpClient } = require('openid-client');
const providerConfig = require('../../modules/oidc/providerConfig');
const oidcService = require('../../modules/oidc/service');
const app = require('../../app');

const withEnv = (vars) =>
    jest.replaceProperty(process, 'env', { ...process.env, ...vars });

const cookiePairs = (response) =>
    (response.headers['set-cookie'] || []).map((c) => c.split(';')[0]);

const bindingCookie = (response) =>
    cookiePairs(response).find((c) => c.startsWith('oidc_binding='));

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const loginWithSession = async (user) => {
    const response = await request(app)
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return cookiePairs(response).find((c) => c.startsWith('connect.sid='));
};

describe('OIDC callback is bound to the browser that started it', () => {
    let lastAuthParams;

    beforeEach(() => {
        withEnv({
            BASE_URL: 'https://todo.example.com',
            OIDC_ENABLED: 'true',
            OIDC_PROVIDER_NAME: 'Test IdP',
            OIDC_PROVIDER_SLUG: 'test',
            OIDC_ISSUER_URL: 'https://id.example.com',
            OIDC_CLIENT_ID: 'client-id',
            OIDC_CLIENT_SECRET: 'client-secret',
        });
        providerConfig.reloadProviders();
        oidcService.clearIssuerCache();

        // restoreMocks resets implementations between tests, so the fake
        // provider is wired up here rather than in the mock factory.
        Issuer.discover.mockResolvedValue({
            metadata: { issuer: 'https://id.example.com' },
            Client: jest.fn(() => idpClient),
        });
        idpClient.authorizationUrl.mockImplementation((params) => {
            lastAuthParams = params;
            return `https://id.example.com/authorize?state=${params.state}`;
        });
        idpClient.callback.mockReset();
        idpClient.callback.mockResolvedValue({
            claims: () => ({
                sub: 'idp-subject-1',
                email: 'sso-user@example.com',
                email_verified: true,
            }),
        });
        idpClient.userinfo.mockReset();
    });

    afterEach(async () => {
        await OIDCIdentity.destroy({ where: {} });
        providerConfig.reloadProviders();
    });

    describe('sign in', () => {
        it('sets an httpOnly binding cookie and sends PKCE parameters', async () => {
            const response = await request(app).get('/api/oidc/auth/test');

            expect(response.status).toBe(302);
            const setCookie = response.headers['set-cookie'].find((c) =>
                c.startsWith('oidc_binding=')
            );
            expect(setCookie).toMatch(/HttpOnly/i);
            expect(setCookie).toMatch(/SameSite=Lax/i);
            expect(setCookie).toMatch(/Path=\/api\/oidc/);
            expect(lastAuthParams.code_challenge).toEqual(expect.any(String));
            expect(lastAuthParams.code_challenge_method).toBe('S256');
        });

        it('completes for the browser that started the flow', async () => {
            const agent = request.agent(app);
            await agent.get('/api/oidc/auth/test');

            const callback = await agent.get(
                `/api/oidc/callback/test?code=abc&state=${lastAuthParams.state}`
            );

            expect(callback.status).toBe(302);
            expect(callback.headers.location).toBe('/today');
            expect(
                await User.findOne({ where: { email: 'sso-user@example.com' } })
            ).not.toBeNull();
            expect(idpClient.callback).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Object),
                expect.objectContaining({ code_verifier: expect.any(String) })
            );
        });

        it('refuses a callback URL replayed in another browser (login CSRF)', async () => {
            await request.agent(app).get('/api/oidc/auth/test');
            const state = lastAuthParams.state;

            const victim = request.agent(app);
            const callback = await victim.get(
                `/api/oidc/callback/test?code=attacker-code&state=${state}`
            );

            expect(callback.status).toBe(302);
            expect(callback.headers.location).toContain('/login?error=');
            expect(callback.headers.location).toContain('session%20mismatch');
            expect(idpClient.callback).not.toHaveBeenCalled();
            expect(
                await User.findOne({ where: { email: 'sso-user@example.com' } })
            ).toBeNull();
        });

        it('refuses a callback that carries a different flows binding cookie', async () => {
            await request.agent(app).get('/api/oidc/auth/test');
            const attackerState = lastAuthParams.state;

            const victim = request.agent(app);
            await victim.get('/api/oidc/auth/test');

            const callback = await victim.get(
                `/api/oidc/callback/test?code=x&state=${attackerState}`
            );

            expect(callback.headers.location).toContain('session%20mismatch');
            expect(idpClient.callback).not.toHaveBeenCalled();
        });

        it('does not accept the same state twice', async () => {
            const start = await request(app).get('/api/oidc/auth/test');
            const binding = bindingCookie(start);
            const url = `/api/oidc/callback/test?code=abc&state=${lastAuthParams.state}`;

            const first = await request(app).get(url).set('Cookie', binding);
            expect(first.headers.location).toBe('/today');

            const replay = await request(app).get(url).set('Cookie', binding);

            expect(replay.headers.location).toContain('/login?error=');
            expect(idpClient.callback).toHaveBeenCalledTimes(1);
        });

        it('does not reflect identity provider error text on the login page', async () => {
            idpClient.callback.mockRejectedValue(
                new Error('invalid_grant: <b>call support on 555-0100</b>')
            );
            const agent = request.agent(app);
            await agent.get('/api/oidc/auth/test');

            const callback = await agent.get(
                `/api/oidc/callback/test?code=abc&state=${lastAuthParams.state}`
            );

            expect(callback.headers.location).toContain('/login?error=');
            expect(decodeURIComponent(callback.headers.location)).toContain(
                'Authentication failed'
            );
            expect(callback.headers.location).not.toContain('support');
        });

        it('refuses an identity whose email the provider did not verify', async () => {
            idpClient.callback.mockResolvedValue({
                claims: () => ({
                    sub: 'idp-subject-2',
                    email: 'unverified@example.com',
                    email_verified: false,
                }),
            });
            const agent = request.agent(app);
            await agent.get('/api/oidc/auth/test');

            const callback = await agent.get(
                `/api/oidc/callback/test?code=abc&state=${lastAuthParams.state}`
            );

            expect(decodeURIComponent(callback.headers.location)).toContain(
                'has not verified this email'
            );
            expect(
                await User.findOne({
                    where: { email: 'unverified@example.com' },
                })
            ).toBeNull();
        });

        it('does not take over an existing account through an unverified email', async () => {
            const victim = await createTestUser({
                email: 'existing-account@example.com',
            });
            idpClient.callback.mockResolvedValue({
                claims: () => ({
                    sub: 'idp-attacker',
                    email: 'existing-account@example.com',
                    email_verified: false,
                }),
            });
            const agent = request.agent(app);
            await agent.get('/api/oidc/auth/test');

            await agent.get(
                `/api/oidc/callback/test?code=abc&state=${lastAuthParams.state}`
            );

            expect(
                await OIDCIdentity.count({ where: { user_id: victim.id } })
            ).toBe(0);
        });
    });

    describe('account linking', () => {
        let attacker, victim;

        beforeEach(async () => {
            const stamp = Date.now();
            attacker = await createTestUser({
                email: `link-attacker_${stamp}@example.com`,
            });
            victim = await createTestUser({
                email: `link-victim_${stamp}@example.com`,
            });
        });

        it('links the identity for the user who started the flow', async () => {
            const agent = await login(attacker);
            const start = await agent.post('/api/oidc/link/test');
            expect(start.status).toBe(200);
            expect(start.body.redirectUrl).toContain(
                'https://id.example.com/authorize'
            );

            const callback = await agent.get(
                `/api/oidc/callback/test?code=abc&state=${lastAuthParams.state}`
            );

            expect(callback.headers.location).toBe(
                '/profile/security?success=linked'
            );
            expect(
                await OIDCIdentity.count({ where: { user_id: attacker.id } })
            ).toBe(1);
        });

        it("does not attach the attacker's identity to a victim who opens the callback URL", async () => {
            const attackerAgent = await login(attacker);
            await attackerAgent.post('/api/oidc/link/test');
            const state = lastAuthParams.state;

            const victimAgent = await login(victim);
            const callback = await victimAgent.get(
                `/api/oidc/callback/test?code=attacker-code&state=${state}`
            );

            expect(callback.headers.location).toContain('/login?error=');
            expect(idpClient.callback).not.toHaveBeenCalled();
            expect(
                await OIDCIdentity.count({ where: { user_id: victim.id } })
            ).toBe(0);
        });

        it('does not attach the identity even if the victim holds their own binding cookie', async () => {
            const attackerAgent = await login(attacker);
            await attackerAgent.post('/api/oidc/link/test');
            const attackerState = lastAuthParams.state;

            const victimAgent = await login(victim);
            await victimAgent.post('/api/oidc/link/test');

            const callback = await victimAgent.get(
                `/api/oidc/callback/test?code=x&state=${attackerState}`
            );

            expect(callback.headers.location).toContain('/login?error=');
            expect(
                await OIDCIdentity.count({ where: { user_id: victim.id } })
            ).toBe(0);
        });

        it('refuses to link for a different user than the one who started the flow', async () => {
            const attackerAgent = await login(attacker);
            const start = await attackerAgent.post('/api/oidc/link/test');
            const attackerBinding = bindingCookie(start);
            const state = lastAuthParams.state;

            const victimSession = await loginWithSession(victim);

            const callback = await request(app)
                .get(`/api/oidc/callback/test?code=x&state=${state}`)
                .set('Cookie', [victimSession, attackerBinding]);

            expect(callback.headers.location).toContain('/login?error=');
            expect(decodeURIComponent(callback.headers.location)).toContain(
                'session mismatch'
            );
            expect(
                await OIDCIdentity.count({ where: { user_id: victim.id } })
            ).toBe(0);
        });
    });
});
