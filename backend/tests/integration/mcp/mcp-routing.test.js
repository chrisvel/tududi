'use strict';

const request = require('supertest');
const app = require('../../../app');
const { User, ApiToken } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

describe('MCP Routing', () => {
    let user, agent, apiToken;

    beforeEach(async () => {
        user = await createTestUser({
            email: `mcp_test_${Date.now()}@example.com`,
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('GET /api/mcp/status', () => {
        let originalEnv;

        beforeEach(() => {
            originalEnv = process.env.FF_ENABLE_MCP;
        });

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env.FF_ENABLE_MCP;
            } else {
                process.env.FF_ENABLE_MCP = originalEnv;
            }
        });

        it('should return enabled: false when feature flag is off', async () => {
            delete process.env.FF_ENABLE_MCP;

            const response = await agent.get('/api/mcp/status');

            expect(response.status).toBe(200);
            expect(response.body.enabled).toBe(false);
        });

        it('should return enabled: true when feature flag is on', async () => {
            process.env.FF_ENABLE_MCP = 'true';

            const response = await agent.get('/api/mcp/status');

            expect(response.status).toBe(200);
            expect(response.body.enabled).toBe(true);
        });

        it('should not require feature flag to be enabled', async () => {
            // Status endpoint should always work regardless of feature flag
            delete process.env.FF_ENABLE_MCP;

            const response = await agent.get('/api/mcp/status');

            expect(response.status).toBe(200);
        });
    });

    describe('GET /api/mcp/config', () => {
        let originalEnv;

        beforeEach(() => {
            originalEnv = process.env.FF_ENABLE_MCP;
        });

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env.FF_ENABLE_MCP;
            } else {
                process.env.FF_ENABLE_MCP = originalEnv;
            }
        });

        it('should require feature flag to be enabled', async () => {
            delete process.env.FF_ENABLE_MCP;

            const response = await agent.get('/api/mcp/config');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('MCP feature is not enabled');
        });

        it('should return Claude Desktop config when feature flag is on', async () => {
            process.env.FF_ENABLE_MCP = 'true';

            const response = await agent.get('/api/mcp/config');

            expect(response.status).toBe(200);
            expect(response.body.mcpServers).toBeDefined();
            expect(response.body.mcpServers.tududi).toBeDefined();
            expect(response.body.mcpServers.tududi.command).toBe('npx');
            expect(response.body.mcpServers.tududi.args).toContain('mcp-remote');
            expect(response.body.mcpServers.tududi.env).toBeDefined();
        });
    });

    describe('GET /api/mcp/tools', () => {
        let originalEnv;

        beforeEach(() => {
            originalEnv = process.env.FF_ENABLE_MCP;
        });

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env.FF_ENABLE_MCP;
            } else {
                process.env.FF_ENABLE_MCP = originalEnv;
            }
        });

        it('should require feature flag to be enabled', async () => {
            delete process.env.FF_ENABLE_MCP;

            const response = await agent.get('/api/mcp/tools');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('MCP feature is not enabled');
        });

        it('should list all tool categories when feature flag is on', async () => {
            process.env.FF_ENABLE_MCP = 'true';

            const response = await agent.get('/api/mcp/tools');

            expect(response.status).toBe(200);
            expect(response.body.tools).toBeInstanceOf(Array);
            expect(response.body.tools.length).toBe(4);

            const categories = response.body.tools.map((t) => t.category);
            expect(categories).toContain('Tasks');
            expect(categories).toContain('Projects');
            expect(categories).toContain('Inbox');
            expect(categories).toContain('Misc');
        });
    });

    describe('POST /api/mcp', () => {
        let originalEnv;

        beforeEach(() => {
            originalEnv = process.env.FF_ENABLE_MCP;
            process.env.FF_ENABLE_MCP = 'true';
        });

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env.FF_ENABLE_MCP;
            } else {
                process.env.FF_ENABLE_MCP = originalEnv;
            }
        });

        it('should require Bearer token authentication', async () => {
            const response = await request(app)
                .post('/api/mcp')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Unauthorized');
        });

        it('should reject invalid Bearer token format', async () => {
            const response = await request(app)
                .post('/api/mcp')
                .set('Authorization', 'Token invalid-token')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(response.status).toBe(401);
            expect(response.body.message).toContain(
                'Invalid Authorization header format'
            );
        });

        it('should reject expired or invalid API tokens', async () => {
            const response = await request(app)
                .post('/api/mcp')
                .set('Authorization', 'Bearer tt_invalid_token_value')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            expect(response.status).toBe(401);
        });

        it('should handle MCP protocol with valid API token', async () => {
            // Create an API token for the test user
            const { findValidTokenByValue } = require('../../../modules/users/apiTokenService');
            const bcrypt = require('bcrypt');

            const tokenValue = `tt_test_${Math.random().toString(36).slice(2, 68)}`;
            const tokenHash = await bcrypt.hash(tokenValue, 10);

            await ApiToken.create({
                user_id: user.id,
                name: 'MCP Test Token',
                token_hash: tokenHash,
                token_prefix: tokenValue.slice(0, 10),
                expires_at: null,
            });

            const response = await request(app)
                .post('/api/mcp')
                .set('Authorization', `Bearer ${tokenValue}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

            // MCP protocol response - should succeed
            expect(response.status).toBe(200);
        });
    });
});
