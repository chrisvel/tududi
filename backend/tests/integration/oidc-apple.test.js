'use strict';

const crypto = require('crypto');
const request = require('supertest');
const { OIDCIdentity, User } = require('../../models');

// Apple is replaced by a fake client; the state, binding cookie, form-post
// hand-off, session and provisioning are all real.
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

const { Issuer, __client: appleClient } = require('openid-client');
const providerConfig = require('../../modules/oidc/providerConfig');
const appleProvider = require('../../modules/oidc/appleProvider');
const oidcService = require('../../modules/oidc/service');
const app = require('../../app');

const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
});

const withEnv = (vars) =>
    jest.replaceProperty(process, 'env', { ...process.env, ...vars });

describe('Sign in with Apple', () => {
    let lastAuthParams;
    let clientMetadata;

    beforeEach(() => {
        withEnv({
            BASE_URL: 'https://todo.example.com',
            OIDC_ENABLED: 'false',
            APPLE_SIGN_IN_CLIENT_ID: 'com.example.tududi.web',
            APPLE_SIGN_IN_TEAM_ID: 'TEAM123456',
            APPLE_SIGN_IN_KEY_ID: 'KEY1234567',
            APPLE_SIGN_IN_PRIVATE_KEY: privateKey
                .export({ type: 'pkcs8', format: 'pem' })
                .replace(/\n/g, '\\n'),
        });
        providerConfig.reloadProviders();
        oidcService.clearIssuerCache();
        appleProvider.clearClientSecretCache();

        Issuer.discover.mockResolvedValue({
            metadata: { issuer: 'https://appleid.apple.com' },
            Client: jest.fn((metadata) => {
                clientMetadata = metadata;
                return appleClient;
            }),
        });
        appleClient.authorizationUrl.mockImplementation((params) => {
            lastAuthParams = params;
            return `https://appleid.apple.com/auth/authorize?state=${params.state}`;
        });
        appleClient.callback.mockReset();
        appleClient.callback.mockResolvedValue({
            access_token: 'apple-access-token',
            claims: () => ({
                iss: 'https://appleid.apple.com',
                sub: 'apple-subject-1',
                email: 'abc123@privaterelay.appleid.com',
                email_verified: 'true',
                is_private_email: 'true',
            }),
        });
        appleClient.userinfo.mockReset();
    });

    afterEach(async () => {
        await OIDCIdentity.destroy({ where: {} });
        providerConfig.reloadProviders();
    });

    it('is listed with the Apple brand even while generic OIDC is off', async () => {
        const response = await request(app).get('/api/oidc/providers');

        expect(response.status).toBe(200);
        expect(response.body.providers).toEqual([
            { slug: 'apple', name: 'Apple', type: 'oidc', brand: 'apple' },
        ]);
    });

    it('asks Apple for a form post callback and signs a client secret', async () => {
        const response = await request(app).get('/api/oidc/auth/apple');

        expect(response.status).toBe(302);
        expect(lastAuthParams).toMatchObject({
            scope: 'openid name email',
            response_mode: 'form_post',
        });
        expect(lastAuthParams.code_challenge).toBeUndefined();
        expect(clientMetadata.token_endpoint_auth_method).toBe(
            'client_secret_post'
        );
        expect(clientMetadata.client_secret.split('.')).toHaveLength(3);
    });

    it('signs up from the form post, naming the account from the first-time user field', async () => {
        const agent = request.agent(app);
        await agent.get('/api/oidc/auth/apple');

        const posted = await agent
            .post('/api/oidc/callback/apple')
            .type('form')
            .send({
                code: 'apple-code',
                state: lastAuthParams.state,
                user: JSON.stringify({
                    name: { firstName: 'Ada', lastName: 'Lovelace' },
                    email: 'abc123@privaterelay.appleid.com',
                }),
            });

        expect(posted.status).toBe(303);
        const target = new URL(posted.headers.location, 'http://x');
        expect(target.pathname).toBe('/api/oidc/callback/apple');
        expect(target.searchParams.get('code')).toBe('apple-code');
        expect(target.searchParams.get('user')).not.toContain('@');

        const callback = await agent.get(posted.headers.location);

        expect(callback.status).toBe(302);
        expect(callback.headers.location).toBe('/today');
        expect(appleClient.callback).toHaveBeenCalledWith(
            'https://todo.example.com/api/oidc/callback/apple',
            { code: 'apple-code', state: lastAuthParams.state },
            expect.objectContaining({ code_verifier: undefined })
        );
        expect(appleClient.userinfo).not.toHaveBeenCalled();

        const user = await User.findOne({
            where: { email: 'abc123@privaterelay.appleid.com' },
        });
        expect(user).toMatchObject({ name: 'Ada', surname: 'Lovelace' });
        expect(
            await OIDCIdentity.count({
                where: { provider_slug: 'apple', subject: 'apple-subject-1' },
            })
        ).toBe(1);
    });

    it('refuses a form post replayed in another browser', async () => {
        await request.agent(app).get('/api/oidc/auth/apple');

        const victim = request.agent(app);
        const posted = await victim
            .post('/api/oidc/callback/apple')
            .type('form')
            .send({ code: 'attacker-code', state: lastAuthParams.state });
        const callback = await victim.get(posted.headers.location);

        expect(callback.headers.location).toContain('session%20mismatch');
        expect(appleClient.callback).not.toHaveBeenCalled();
    });
});
