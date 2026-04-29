'use strict';

const {
    authenticateMcpRequest,
} = require('../../../../modules/mcp/middleware');

describe('MCP Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    describe('authenticateMcpRequest', () => {
        it('should map req.currentUser to req.mcpUser and call next', () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            req.currentUser = mockUser;

            authenticateMcpRequest(req, res, next);

            expect(req.mcpUser).toBe(mockUser);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should pass through when currentUser is undefined', () => {
            req.currentUser = undefined;

            authenticateMcpRequest(req, res, next);

            expect(req.mcpUser).toBeUndefined();
            expect(next).toHaveBeenCalled();
        });
    });
});
