const { requireAuth } = require('../../../middleware/auth');
const { User } = require('../../../models');

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
});
