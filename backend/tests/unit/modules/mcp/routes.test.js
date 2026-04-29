'use strict';

const request = require('supertest');
const app = require('../../../app');
const { createTestUser } = require('../../helpers/testUtils');

describe('MCP Routes - Feature Flag', () => {
    let user, agent;
    let originalEnv;

    beforeEach(async () => {
        user = await createTestUser({
            email: `mcp_route_test_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });

        originalEnv = process.env.FF_ENABLE_MCP;
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.FF_ENABLE_MCP;
        } else {
            process.env.FF_ENABLE_MCP = originalEnv;
        }
    });

    describe('feature flag enforcement', () => {
        const protectedEndpoints = [
            { method: 'GET', path: '/api/mcp/config' },
            { method: 'GET', path: '/api/mcp/tools' },
            { method: 'POST', path: '/api/mcp' },
        ];

        protectedEndpoints.forEach(({ method, path }) => {
            it(`should block ${method} ${path} when feature flag is disabled`, async () => {
                delete process.env.FF_ENABLE_MCP;

                const response = await agent[path === '/api/mcp' ? 'post' : 'get'](
                    path
                ).send({});

                if (path === '/api/mcp') {
                    // POST /api/mcp will hit auth middleware first (401) or feature flag (403)
                    expect([401, 403]).toContain(response.status);
                } else {
                    expect(response.status).toBe(403);
                    expect(response.body.error).toBe('MCP feature is not enabled');
                }
            });
        });

        it('should allow GET /api/mcp/status regardless of feature flag', async () => {
            delete process.env.FF_ENABLE_MCP;

            const response = await agent.get('/api/mcp/status');

            expect(response.status).toBe(200);
            expect(response.body.enabled).toBe(false);
        });

        it('should allow GET /api/mcp/status when feature flag is enabled', async () => {
            process.env.FF_ENABLE_MCP = 'true';

            const response = await agent.get('/api/mcp/status');

            expect(response.status).toBe(200);
            expect(response.body.enabled).toBe(true);
        });
    });
});
