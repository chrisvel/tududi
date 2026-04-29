'use strict';

const { authenticateMcpRequest } = require('../../../../modules/mcp/middleware');

// Mock dependencies
jest.mock('../../../../modules/users/apiTokenService', () => ({
    findValidTokenByValue: jest.fn(),
}));

jest.mock('../../../../models', () => ({
    User: {
        findByPk: jest.fn(),
    },
}));

const { findValidTokenByValue } = require('../../../../modules/users/apiTokenService');
const { User } = require('../../../../models');

describe('MCP Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            headers: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    describe('authenticateMcpRequest', () => {
        it('should reject request without Authorization header', async () => {
            await authenticateMcpRequest(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Unauthorized',
                    message: expect.stringContaining('Missing Authorization header'),
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject request with non-Bearer Authorization header', async () => {
            req.headers.authorization = 'Token some-token';

            await authenticateMcpRequest(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Unauthorized',
                    message: expect.stringContaining('Invalid Authorization header format'),
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject request with invalid API token', async () => {
            req.headers.authorization = 'Bearer invalid-token';
            findValidTokenByValue.mockResolvedValue(null);

            await authenticateMcpRequest(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Unauthorized',
                    message: expect.stringContaining('Invalid or expired API token'),
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject request when user is not found for token', async () => {
            req.headers.authorization = 'Bearer valid-token';
            findValidTokenByValue.mockResolvedValue({ user_id: 42 });
            User.findByPk.mockResolvedValue(null);

            await authenticateMcpRequest(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Unauthorized',
                    message: expect.stringContaining('User not found'),
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        it('should attach user and token context and call next on valid auth', async () => {
            const mockUser = { id: 42, email: 'test@example.com' };
            const mockToken = { user_id: 42, name: 'test-token' };

            req.headers.authorization = 'Bearer valid-token';
            findValidTokenByValue.mockResolvedValue(mockToken);
            User.findByPk.mockResolvedValue(mockUser);

            await authenticateMcpRequest(req, res, next);

            expect(findValidTokenByValue).toHaveBeenCalledWith('valid-token');
            expect(User.findByPk).toHaveBeenCalledWith(42);
            expect(req.mcpUser).toBe(mockUser);
            expect(req.mcpApiToken).toBe(mockToken);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should handle errors from token validation gracefully', async () => {
            req.headers.authorization = 'Bearer token';
            findValidTokenByValue.mockRejectedValue(new Error('DB connection failed'));

            await authenticateMcpRequest(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Authentication error',
                    message: 'DB connection failed',
                })
            );
        });
    });
});
