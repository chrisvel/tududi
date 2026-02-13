const request = require('supertest');
const app = require('../../app');
const { User, Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { createApiToken } = require('../../modules/users/apiTokenService');

describe('MCP Streamable HTTP at /mcp', () => {
    let user;
    let rawToken;

    beforeEach(async () => {
        user = await createTestUser({
            email: `mcp_${Date.now()}@example.com`,
        });
        const { rawToken: token } = await createApiToken({
            userId: user.id,
            name: 'MCP Test Key',
        });
        rawToken = token;
    });

    describe('Authentication', () => {
        it('should reject GET /mcp without auth with 401', async () => {
            const response = await request(app).get('/mcp');
            expect(response.status).toBe(401);
        });

        it('should reject POST /mcp without auth with 401', async () => {
            const response = await request(app)
                .post('/mcp')
                .set('Content-Type', 'application/json')
                .send({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {},
                });
            expect(response.status).toBe(401);
        });

        it('should return 405 for GET /mcp with valid auth', async () => {
            const response = await request(app)
                .get('/mcp')
                .set('Authorization', `Bearer ${rawToken}`);
            expect(response.status).toBe(405);
            expect(response.headers.allow).toBe('POST');
        });
    });

    describe('JSON-RPC lifecycle', () => {
        it('should respond to initialize with server capabilities', async () => {
            const response = await request(app)
                .post('/mcp')
                .set('Authorization', `Bearer ${rawToken}`)
                .set('Content-Type', 'application/json')
                .send({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: { protocolVersion: '2025-03-26' },
                });

            expect(response.status).toBe(200);
            expect(response.body.jsonrpc).toBe('2.0');
            expect(response.body.id).toBe(1);
            expect(response.body.result).toBeDefined();
            expect(response.body.result.protocolVersion).toBeDefined();
            expect(response.body.result.capabilities.tools.listChanged).toBe(true);
            expect(response.body.result.serverInfo.name).toBe('Tududi');
        });

        it('should respond to tools/list with tool definitions', async () => {
            const response = await request(app)
                .post('/mcp')
                .set('Authorization', `Bearer ${rawToken}`)
                .set('Content-Type', 'application/json')
                .send({
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'tools/list',
                    params: {},
                });

            expect(response.status).toBe(200);
            expect(response.body.result.tools).toBeDefined();
            expect(Array.isArray(response.body.result.tools)).toBe(true);
            const names = response.body.result.tools.map((t) => t.name);
            expect(names).toContain('tasks_list');
            expect(names).toContain('task_create');
            expect(names).toContain('projects_list');
        });

        it('should respond to tools/call tasks_list with same data as GET /api/tasks', async () => {
            const response = await request(app)
                .post('/mcp')
                .set('Authorization', `Bearer ${rawToken}`)
                .set('Content-Type', 'application/json')
                .send({
                    jsonrpc: '2.0',
                    id: 3,
                    method: 'tools/call',
                    params: {
                        name: 'tasks_list',
                        arguments: {},
                    },
                });

            expect(response.status).toBe(200);
            expect(response.body.result).toBeDefined();
            expect(response.body.result.content).toBeDefined();
            expect(response.body.result.content[0].type).toBe('text');
            const data = JSON.parse(response.body.result.content[0].text);
            expect(data.tasks).toBeDefined();
            expect(Array.isArray(data.tasks)).toBe(true);
        });

        it('should create a task via tools/call task_create', async () => {
            const response = await request(app)
                .post('/mcp')
                .set('Authorization', `Bearer ${rawToken}`)
                .set('Content-Type', 'application/json')
                .send({
                    jsonrpc: '2.0',
                    id: 4,
                    method: 'tools/call',
                    params: {
                        name: 'task_create',
                        arguments: { name: 'MCP-created task' },
                    },
                });

            expect(response.status).toBe(200);
            expect(response.body.result.isError).not.toBe(true);
            const data = JSON.parse(response.body.result.content[0].text);
            expect(data.name).toBe('MCP-created task');

            const task = await Task.findOne({
                where: { name: 'MCP-created task', user_id: user.id },
            });
            expect(task).not.toBeNull();
        });

        it('should return tool execution error for unknown tool', async () => {
            const response = await request(app)
                .post('/mcp')
                .set('Authorization', `Bearer ${rawToken}`)
                .set('Content-Type', 'application/json')
                .send({
                    jsonrpc: '2.0',
                    id: 5,
                    method: 'tools/call',
                    params: {
                        name: 'nonexistent_tool',
                        arguments: {},
                    },
                });

            expect(response.status).toBe(200);
            expect(response.body.result.isError).toBe(true);
            expect(response.body.result.content[0].text).toContain('Unknown tool');
        });
    });
});
