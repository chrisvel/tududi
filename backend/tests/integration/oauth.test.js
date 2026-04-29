'use strict';

const request = require('supertest');
const { OIDCIdentity } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Prevent openid-client from making real network calls during discovery.
jest.mock('openid-client', () => {
    const MockClient = jest.fn();
    const MockIssuer = {
        discover: jest.fn().mockResolvedValue({
            jwks_uri: 'https://id.example.com/.well-known/jwks.json',
            authorization_endpoint: 'https://id.example.com/authorize',
            token_endpoint: 'https://id.example.com/token',
            Client: MockClient,
        }),
        Client: MockClient,
    };
    return {
        Issuer: MockIssuer,
        generators: {
            state: jest.fn(),
            nonce: jest.fn(),
            codeVerifier: jest.fn(),
            codeChallenge: jest.fn(),
        },
    };
});

// Mock validateAccessToken so JWT tests don't need a live JWKS endpoint.
// All other logic in auth.js (OIDCIdentity lookup, WWW-Authenticate header, etc.) runs for real.
jest.mock('../../modules/oidc/service', () => ({
    validateAccessToken: jest.fn(),
}));

const { validateAccessToken } = require('../../modules/oidc/service');
const app = require('../../app');

// jest.replaceProperty restores automatically between tests (restoreMocks: true in jest.config.js).
const withEnv = (vars) =>
    jest.replaceProperty(process, 'env', { ...process.env, ...vars });

describe('OAuth2 resource server', () => {
    afterEach(async () => {
        await OIDCIdentity.destroy({ where: {} });
    });

    describe('GET /.well-known/oauth-protected-resource', () => {
        it('returns 404 when OIDC is disabled', async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: undefined,
                OIDC_ISSUER_URL: 'https://id.example.com',
            });
            const res = await request(app).get(
                '/.well-known/oauth-protected-resource'
            );
            expect(res.status).toBe(404);
        });

        it('returns 200 without authentication when OIDC is enabled', async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: 'true',
                OIDC_ISSUER_URL: 'https://id.example.com',
            });
            const res = await request(app).get(
                '/.well-known/oauth-protected-resource'
            );
            expect(res.status).toBe(200);
        });

        it('returns correct RFC 9728 body', async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: 'true',
                OIDC_ISSUER_URL: 'https://id.example.com',
            });
            const res = await request(app).get(
                '/.well-known/oauth-protected-resource'
            );
            expect(res.body).toEqual({
                resource: 'https://app.example.com',
                authorization_servers: ['https://id.example.com'],
                scopes_supported: ['openid', 'email', 'profile'],
            });
        });

        it('returns application/json content type', async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: 'true',
                OIDC_ISSUER_URL: 'https://id.example.com',
            });
            const res = await request(app).get(
                '/.well-known/oauth-protected-resource'
            );
            expect(res.headers['content-type']).toMatch(/application\/json/);
        });
    });

    describe('WWW-Authenticate header on 401', () => {
        it('is present when OIDC is enabled and no credentials are supplied', async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: 'true',
            });
            const res = await request(app).get('/api/tasks');
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toMatch(
                /Bearer resource_metadata="https:\/\/app\.example\.com\/.well-known\/oauth-protected-resource"/
            );
        });

        it('is present when OIDC is enabled and an invalid Bearer token is supplied', async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: 'true',
            });
            validateAccessToken.mockRejectedValueOnce(
                new Error('invalid token')
            );
            const res = await request(app)
                .get('/api/tasks')
                .set('Authorization', 'Bearer bogus');
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toBeDefined();
        });

        it('is absent when OIDC is disabled', async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: undefined,
            });
            const res = await request(app).get('/api/tasks');
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toBeUndefined();
        });
    });

    describe('JWT Bearer authentication', () => {
        let user;

        beforeEach(async () => {
            withEnv({
                BASE_URL: 'https://app.example.com',
                OIDC_ENABLED: 'true',
                OIDC_ISSUER_URL: 'https://id.example.com',
            });

            user = await createTestUser({
                email: `jwt_${Date.now()}@example.com`,
            });
            await OIDCIdentity.create({
                user_id: user.id,
                provider_slug: 'test-provider',
                subject: 'sub-abc123',
                email: user.email,
            });
        });

        it('authenticates a valid JWT and allows access', async () => {
            validateAccessToken.mockResolvedValueOnce({ sub: 'sub-abc123' });
            const res = await request(app)
                .get('/api/tasks')
                .set('Authorization', 'Bearer valid.jwt.token');
            expect(res.status).toBe(200);
        });

        it('rejects a JWT that fails validation', async () => {
            validateAccessToken.mockRejectedValueOnce(
                new Error('invalid signature')
            );
            const res = await request(app)
                .get('/api/tasks')
                .set('Authorization', 'Bearer bad.jwt.token');
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toBeDefined();
        });

        it('rejects a JWT whose sub has no linked OIDC identity', async () => {
            validateAccessToken.mockResolvedValueOnce({ sub: 'unknown-sub' });
            const res = await request(app)
                .get('/api/tasks')
                .set('Authorization', 'Bearer valid.jwt.token');
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/No account found/i);
        });

        it('does not invoke JWT validation for tt_ API keys', async () => {
            const agent = request.agent(app);
            await agent
                .post('/api/login')
                .send({ email: user.email, password: 'password123' });
            const keyRes = await agent
                .post('/api/profile/api-keys')
                .send({ name: 'test' });
            const res = await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${keyRes.body.token}`);
            expect(res.status).toBe(200);
            expect(validateAccessToken).not.toHaveBeenCalled();
        });
    });
});
