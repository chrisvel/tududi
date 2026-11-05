'use strict';

process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'mfa-oidc-test-session-secret';

const request = require('supertest');
const { OIDCIdentity, User, UserMfa } = require('../../models');

// Same fake identity provider as oidc-flow-binding.test.js.
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
const secretCipher = require('../../shared/crypto/secretCipher');
const totp = require('../../modules/mfa/totp');
const app = require('../../app');

const withEnv = (vars) =>
    jest.replaceProperty(process, 'env', { ...process.env, ...vars });

// Two-factor sign-in belongs to the account, so it applies after SSO too.
describe('Two-factor sign-in after SSO', () => {
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
                sub: 'idp-subject-mfa',
                email: 'sso-mfa@example.com',
                email_verified: true,
            }),
        });
        idpClient.userinfo.mockReset();
    });

    afterEach(async () => {
        await OIDCIdentity.destroy({ where: {} });
        providerConfig.reloadProviders();
    });

    const ssoSignIn = async () => {
        const agent = request.agent(app);
        await agent.get('/api/oidc/auth/test');
        const callback = await agent.get(
            `/api/oidc/callback/test?code=abc&state=${lastAuthParams.state}`
        );
        return { agent, callback };
    };

    it('signs in straight away without 2FA', async () => {
        const { agent, callback } = await ssoSignIn();

        expect(callback.headers.location).toBe('/today');
        expect((await agent.get('/api/profile')).status).toBe(200);
    });

    it('stops at the code prompt when the account has 2FA on', async () => {
        await ssoSignIn();
        const user = await User.findOne({
            where: { email: 'sso-mfa@example.com' },
        });
        const secret = totp.generateSecret();
        await UserMfa.create({
            user_id: user.id,
            secret_encrypted: secretCipher.encrypt(secret),
            enabled_at: new Date(),
        });

        const { agent, callback } = await ssoSignIn();

        expect(callback.headers.location).toBe('/login?mfa=1');
        expect((await agent.get('/api/profile')).status).toBe(401);
        expect((await agent.get('/api/current_user')).body.mfa_pending).toBe(
            true
        );

        const done = await agent
            .post('/api/login/mfa')
            .send({ code: totp.codeAt(secret, totp.stepAt(Date.now())) });
        expect(done.status).toBe(200);
        expect((await agent.get('/api/profile')).status).toBe(200);
    });
});
