'use strict';

// Life-to-Day (T-1001): with OIDC_ENABLED and the embedded OAuth server off,
// an access token from the sign-in provider reaches /api/mcp. The kill
// switch must end it there like every other bearer credential, and leave the
// REST API alone.
const request = require('supertest');
const { OIDCIdentity } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

jest.mock('../../modules/oidc/service', () => ({
    validateAccessToken: jest.fn(),
}));
const { validateAccessToken } = require('../../modules/oidc/service');
const app = require('../../app');

const BEARER = 'Bearer provider.jwt.token';
const listTools = () =>
    request(app)
        .post('/api/mcp')
        .set('Authorization', BEARER)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
const seconds = (ms) => Math.floor(ms / 1000);

describe('kill switch and sign-in provider tokens on /api/mcp', () => {
    let agent;

    beforeEach(async () => {
        jest.replaceProperty(process, 'env', {
            ...process.env,
            OIDC_ENABLED: 'true',
            BASE_URL: 'https://app.example.com',
            LTD_OAUTH_ENABLED: '',
        });
        const user = await createTestUser({
            email: `oidc_kill_${Date.now()}@example.com`,
        });
        await OIDCIdentity.create({
            user_id: user.id,
            provider_slug: 'test-provider',
            subject: `sub-${user.id}`,
            email: user.email,
        });
        validateAccessToken.mockImplementation(async () => ({
            sub: `sub-${user.id}`,
            iat: seconds(Date.now()) - 60,
        }));
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    afterEach(() => OIDCIdentity.destroy({ where: {} }));

    it('ends a token issued before the switch on MCP and keeps REST', async () => {
        expect((await listTools()).status).toBe(200);
        expect((await agent.post('/api/mcp/kill-switch').send({})).status).toBe(
            200
        );
        expect((await listTools()).status).toBe(401);
        expect(
            (await request(app).get('/api/tasks').set('Authorization', BEARER))
                .status
        ).toBe(200);
    });

    it('accepts a token the provider issued after the switch', async () => {
        await agent.post('/api/mcp/kill-switch').send({});
        const { sub } = await validateAccessToken();
        validateAccessToken.mockImplementation(async () => ({
            sub,
            iat: seconds(Date.now()) + 1,
        }));
        expect((await listTools()).status).toBe(200);
    });

    it('treats a token without iat as issued before the switch', async () => {
        const { sub } = await validateAccessToken();
        validateAccessToken.mockImplementation(async () => ({ sub }));
        await agent.post('/api/mcp/kill-switch').send({});
        expect((await listTools()).status).toBe(401);
    });
});
