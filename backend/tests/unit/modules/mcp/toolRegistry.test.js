'use strict';

const { registerAllTools } = require('../../../../modules/mcp/toolRegistry');

// Mock tool registrars
jest.mock('../../../../modules/mcp/tools/taskTools', () => ({
    registerTaskTools: jest.fn(),
}));
jest.mock('../../../../modules/mcp/tools/projectTools', () => ({
    registerProjectTools: jest.fn(),
}));
jest.mock('../../../../modules/mcp/tools/inboxTools', () => ({
    registerInboxTools: jest.fn(),
}));
jest.mock('../../../../modules/mcp/tools/miscTools', () => ({
    registerMiscTools: jest.fn(),
}));

const {
    registerTaskTools,
} = require('../../../../modules/mcp/tools/taskTools');
const {
    registerProjectTools,
} = require('../../../../modules/mcp/tools/projectTools');
const {
    registerInboxTools,
} = require('../../../../modules/mcp/tools/inboxTools');
const {
    registerMiscTools,
} = require('../../../../modules/mcp/tools/miscTools');

describe('MCP ToolRegistry', () => {
    describe('registerAllTools', () => {
        it('should call all tool registrar functions', () => {
            const mockServer = {};
            const mockContext = { userId: 1, user: {}, apiToken: {} };
            const mockTools = [];

            registerAllTools(mockServer, mockContext, mockTools);

            expect(registerTaskTools).toHaveBeenCalledWith(
                mockServer,
                mockContext,
                mockTools
            );
            expect(registerProjectTools).toHaveBeenCalledWith(
                mockServer,
                mockContext,
                mockTools
            );
            expect(registerInboxTools).toHaveBeenCalledWith(
                mockServer,
                mockContext,
                mockTools
            );
            expect(registerMiscTools).toHaveBeenCalledWith(
                mockServer,
                mockContext,
                mockTools
            );
        });

        it('should pass the same context to all registrars', () => {
            const mockServer = {};
            const mockContext = {
                userId: 42,
                user: { id: 42, email: 'test@example.com' },
                apiToken: { name: 'test-token' },
            };
            const mockTools = [];

            registerAllTools(mockServer, mockContext, mockTools);

            // Verify all registrars received the same context object
            const taskContext = registerTaskTools.mock.calls[0][1];
            const projectContext = registerProjectTools.mock.calls[0][1];
            const inboxContext = registerInboxTools.mock.calls[0][1];
            const miscContext = registerMiscTools.mock.calls[0][1];

            expect(taskContext).toBe(mockContext);
            expect(projectContext).toBe(mockContext);
            expect(inboxContext).toBe(mockContext);
            expect(miscContext).toBe(mockContext);
        });

        it('should pass the same tools array to all registrars', () => {
            const mockServer = {};
            const mockContext = {};
            const mockTools = [];

            registerAllTools(mockServer, mockContext, mockTools);

            // Verify all registrars received the same tools array
            const taskTools = registerTaskTools.mock.calls[0][2];
            const projectTools = registerProjectTools.mock.calls[0][2];
            const inboxTools = registerInboxTools.mock.calls[0][2];
            const miscTools = registerMiscTools.mock.calls[0][2];

            expect(taskTools).toBe(mockTools);
            expect(projectTools).toBe(mockTools);
            expect(inboxTools).toBe(mockTools);
            expect(miscTools).toBe(mockTools);
        });

        it('should pass the same server to all registrars', () => {
            const mockServer = { name: 'mock-server' };
            const mockContext = {};
            const mockTools = [];

            registerAllTools(mockServer, mockContext, mockTools);

            expect(registerTaskTools).toHaveBeenCalledWith(
                mockServer,
                expect.anything(),
                expect.anything()
            );
            expect(registerProjectTools).toHaveBeenCalledWith(
                mockServer,
                expect.anything(),
                expect.anything()
            );
            expect(registerInboxTools).toHaveBeenCalledWith(
                mockServer,
                expect.anything(),
                expect.anything()
            );
            expect(registerMiscTools).toHaveBeenCalledWith(
                mockServer,
                expect.anything(),
                expect.anything()
            );
        });
    });
});
