const { requireAuth } = require('../../../middleware/auth');
const { User } = require('../../../models');
const { createApiToken } = require('../../../modules/users/apiTokenService');

describe('Auth Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            path: '/api/tasks',
            session: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    it('should skip authentication for health check', async () => {
        req.path = '/api/health';

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip authentication for login route', async () => {
        req.path = '/api/login';

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip authentication for current_user route', async () => {
        req.path = '/api/current_user';

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no session', async () => {
        req.session = null;

        await requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Authentication required',
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if no userId in session', async () => {
        req.session = {};

        await requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Authentication required',
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 and destroy session if user not found', async () => {
        const bcrypt = require('bcrypt');
        const user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        req.session = {
            userId: user.id + 1, // Non-existent user ID
            destroy: jest.fn(),
        };

        await requireAuth(req, res, next);

        expect(req.session.destroy).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should set currentUser and call next for valid session', async () => {
        const bcrypt = require('bcrypt');
        const user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        req.session = {
            userId: user.id,
        };

        await requireAuth(req, res, next);

        expect(req.currentUser).toBeDefined();
        expect(req.currentUser.id).toBe(user.id);
        expect(req.currentUser.email).toBe(user.email);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
        // Mock console.error to suppress expected error log in test output
        const originalConsoleError = console.error;
        console.error = jest.fn();

        // Mock User.findByPk to throw an error
        const originalFindByPk = User.findByPk;
        User.findByPk = jest
            .fn()
            .mockRejectedValue(new Error('Database connection error'));

        req.session = {
            userId: 123,
            destroy: jest.fn(),
        };

        await requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Authentication error',
        });
        expect(next).not.toHaveBeenCalled();

        // Restore original methods
        User.findByPk = originalFindByPk;
        console.error = originalConsoleError;
    });

    // --- API Token (Bearer) authentication ---

    describe('Bearer token authentication', () => {
        let user;

        beforeEach(async () => {
            const { sequelize } = require('../../../models');
            await sequelize.query('DELETE FROM api_tokens');
            const bcrypt = require('bcrypt');
            user = await User.create({
                email: 'token-user@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });
            // No session – forces the bearer path
            req.session = null;
            req.headers = {};
        });

        it('should authenticate with a valid Bearer token', async () => {
            const { rawToken } = await createApiToken({
                userId: user.id,
                name: 'test',
            });
            req.headers = { authorization: `Bearer ${rawToken}` };

            await requireAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.currentUser.id).toBe(user.id);
            expect(req.authToken).toBeDefined();
        });

        it('should return 401 for an invalid Bearer token', async () => {
            req.headers = { authorization: 'Bearer invalid-token-value' };

            await requireAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Invalid or expired API token',
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 for a revoked token', async () => {
            const { rawToken, tokenRecord } = await createApiToken({
                userId: user.id,
                name: 'revoked',
            });
            await tokenRecord.update({ revoked_at: new Date() });
            req.headers = { authorization: `Bearer ${rawToken}` };

            await requireAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Invalid or expired API token',
            });
        });

        it('should return 401 for an expired token', async () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const { rawToken } = await createApiToken({
                userId: user.id,
                name: 'expired',
                expiresAt: pastDate,
            });
            req.headers = { authorization: `Bearer ${rawToken}` };

            await requireAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Invalid or expired API token',
            });
        });

        it('should return 401 when Authorization header has no token value', async () => {
            req.headers = { authorization: 'Bearer ' };

            await requireAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 for non-Bearer scheme', async () => {
            req.headers = { authorization: 'Basic abc123' };

            await requireAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when token user no longer exists', async () => {
            const originalConsoleError = console.error;
            console.error = jest.fn();

            const { rawToken } = await createApiToken({
                userId: user.id,
                name: 'orphan',
            });
            // Destroying the user cascade-deletes associated tokens,
            // so the token lookup itself fails rather than the user lookup
            await user.destroy();
            req.headers = { authorization: `Bearer ${rawToken}` };

            await requireAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();

            console.error = originalConsoleError;
        });

        it('should update last_used_at when token has not been used recently', async () => {
            const { rawToken, tokenRecord } = await createApiToken({
                userId: user.id,
                name: 'fresh',
            });
            // Ensure last_used_at is old enough to trigger update
            await tokenRecord.update({
                last_used_at: new Date(Date.now() - 10 * 60 * 1000),
            });
            req.headers = { authorization: `Bearer ${rawToken}` };

            await requireAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            // Give the fire-and-forget update a moment to complete
            await new Promise((r) => setTimeout(r, 100));
            await tokenRecord.reload();
            // last_used_at should be updated to roughly now
            expect(
                Date.now() - tokenRecord.last_used_at.getTime()
            ).toBeLessThan(5000);
        });

        it('should skip health check even with no session and no token', async () => {
            req.path = '/api/health';
            req.headers = {};

            await requireAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });
});
