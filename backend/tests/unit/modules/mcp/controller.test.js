'use strict';

const controller = require('../../../../modules/mcp/controller');

// Mock dependencies
jest.mock('../../../../modules/mcp/httpTransport', () => ({
    handleMcpHttpRequest: jest.fn(),
}));

const { handleMcpHttpRequest } = require('../../../../modules/mcp/httpTransport');

describe('MCP Controller', () => {
    describe('getMcpStatus', () => {
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

        it('should return enabled: false when FF_ENABLE_MCP is not set', async () => {
            delete process.env.FF_ENABLE_MCP;

            const res = { json: jest.fn() };
            await controller.getMcpStatus({}, res);

            expect(res.json).toHaveBeenCalledWith({ enabled: false });
        });

        it('should return enabled: false when FF_ENABLE_MCP is false', async () => {
            process.env.FF_ENABLE_MCP = 'false';

            const res = { json: jest.fn() };
            await controller.getMcpStatus({}, res);

            expect(res.json).toHaveBeenCalledWith({ enabled: false });
        });

        it('should return enabled: true when FF_ENABLE_MCP is true', async () => {
            process.env.FF_ENABLE_MCP = 'true';

            const res = { json: jest.fn() };
            await controller.getMcpStatus({}, res);

            expect(res.json).toHaveBeenCalledWith({ enabled: true });
        });
    });

    describe('getMcpConfig', () => {
        it('should return Claude Desktop configuration with HTTPS URL', async () => {
            const req = {
                protocol: 'https',
                get: jest.fn().mockReturnValue('app.example.com'),
            };
            const res = { json: jest.fn() };

            await controller.getMcpConfig(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    mcpServers: expect.objectContaining({
                        tududi: expect.objectContaining({
                            command: 'npx',
                            args: expect.arrayContaining([
                                'mcp-remote',
                                'https://app.example.com/api/mcp',
                            ]),
                        }),
                    }),
                })
            );
        });

        it('should return Claude Desktop configuration with HTTP URL', async () => {
            const req = {
                protocol: 'http',
                get: jest.fn().mockReturnValue('localhost:3002'),
            };
            const res = { json: jest.fn() };

            await controller.getMcpConfig(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    mcpServers: expect.objectContaining({
                        tududi: expect.objectContaining({
                            args: expect.arrayContaining([
                                'http://localhost:3002/api/mcp',
                            ]),
                        }),
                    }),
                })
            );
        });

        it('should include header configuration in args', async () => {
            const req = {
                protocol: 'https',
                get: jest.fn().mockReturnValue('app.example.com'),
            };
            const res = { json: jest.fn() };

            await controller.getMcpConfig(req, res);

            const config = res.json.mock.calls[0][0];
            const args = config.mcpServers.tududi.args;
            expect(args).toContain('--header');
            expect(args.some((a) => a.includes('Authorization:Bearer'))).toBe(true);
        });

        it('should include TUDUDI_API_TOKEN placeholder in env', async () => {
            const req = {
                protocol: 'https',
                get: jest.fn().mockReturnValue('app.example.com'),
            };
            const res = { json: jest.fn() };

            await controller.getMcpConfig(req, res);

            const config = res.json.mock.calls[0][0];
            expect(config.mcpServers.tududi.env.TUDUDI_API_TOKEN).toBe(
                'YOUR_API_TOKEN_HERE'
            );
        });
    });

    describe('listMcpTools', () => {
        it('should return tool categories with expected counts', async () => {
            const res = { json: jest.fn() };
            await controller.listMcpTools({}, res);

            const result = res.json.mock.calls[0][0];
            expect(result.tools).toHaveLength(4);

            const categories = result.tools.map((t) => t.category);
            expect(categories).toContain('Tasks');
            expect(categories).toContain('Projects');
            expect(categories).toContain('Inbox');
            expect(categories).toContain('Misc');
        });

        it('should list task tools', async () => {
            const res = { json: jest.fn() };
            await controller.listMcpTools({}, res);

            const result = res.json.mock.calls[0][0];
            const taskCategory = result.tools.find((t) => t.category === 'Tasks');

            expect(taskCategory).toBeDefined();
            expect(taskCategory.count).toBe(8);
            expect(taskCategory.tools).toContain('list_tasks');
            expect(taskCategory.tools).toContain('get_task');
            expect(taskCategory.tools).toContain('create_task');
            expect(taskCategory.tools).toContain('update_task');
            expect(taskCategory.tools).toContain('complete_task');
            expect(taskCategory.tools).toContain('delete_task');
            expect(taskCategory.tools).toContain('add_subtask');
            expect(taskCategory.tools).toContain('get_task_metrics');
        });

        it('should list project tools', async () => {
            const res = { json: jest.fn() };
            await controller.listMcpTools({}, res);

            const result = res.json.mock.calls[0][0];
            const projectCategory = result.tools.find(
                (t) => t.category === 'Projects'
            );

            expect(projectCategory).toBeDefined();
            expect(projectCategory.count).toBe(3);
            expect(projectCategory.tools).toContain('list_projects');
            expect(projectCategory.tools).toContain('create_project');
            expect(projectCategory.tools).toContain('update_project');
        });

        it('should list inbox tools', async () => {
            const res = { json: jest.fn() };
            await controller.listMcpTools({}, res);

            const result = res.json.mock.calls[0][0];
            const inboxCategory = result.tools.find(
                (t) => t.category === 'Inbox'
            );

            expect(inboxCategory).toBeDefined();
            expect(inboxCategory.count).toBe(2);
            expect(inboxCategory.tools).toContain('list_inbox');
            expect(inboxCategory.tools).toContain('add_to_inbox');
        });

        it('should list misc tools', async () => {
            const res = { json: jest.fn() };
            await controller.listMcpTools({}, res);

            const result = res.json.mock.calls[0][0];
            const miscCategory = result.tools.find(
                (t) => t.category === 'Misc'
            );

            expect(miscCategory).toBeDefined();
            expect(miscCategory.count).toBe(3);
            expect(miscCategory.tools).toContain('list_areas');
            expect(miscCategory.tools).toContain('list_tags');
            expect(miscCategory.tools).toContain('search');
        });
    });

    describe('handleMcpMessage', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should delegate to handleMcpHttpRequest', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockToken = { name: 'test-token' };
            const mockReq = { mcpUser: mockUser, mcpApiToken: mockToken };
            const mockRes = {};

            handleMcpHttpRequest.mockResolvedValue(undefined);

            await controller.handleMcpMessage(mockReq, mockRes);

            expect(handleMcpHttpRequest).toHaveBeenCalledWith(
                mockReq,
                mockRes,
                mockUser,
                mockToken
            );
        });

        it('should return 500 when handleMcpHttpRequest throws', async () => {
            const mockReq = { mcpUser: {}, mcpApiToken: {} };
            const mockRes = {
                headersSent: false,
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            handleMcpHttpRequest.mockRejectedValue(
                new Error('Transport error')
            );

            await controller.handleMcpMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Failed to process MCP message',
                    message: 'Transport error',
                })
            );
        });

        it('should not send response when headers already sent', async () => {
            const mockReq = { mcpUser: {}, mcpApiToken: {} };
            const mockRes = {
                headersSent: true,
                status: jest.fn(),
                json: jest.fn(),
            };

            handleMcpHttpRequest.mockRejectedValue(
                new Error('Transport error')
            );

            await controller.handleMcpMessage(mockReq, mockRes);

            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });
});
