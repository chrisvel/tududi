const { hasAccess } = require('../../../middleware/authorize');
const permissionsService = require('../../../services/permissionsService');

jest.mock('../../../services/permissionsService');

describe('authorize middleware – hasAccess', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            currentUser: { id: 42 },
            session: { userId: 42 },
            params: { uid: 'abc123' },
        };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        next = jest.fn();
        jest.clearAllMocks();
    });

    // --- UID resolution ---

    it('should resolve uid from a function', async () => {
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('ro', 'project', (r) => r.params.uid);

        await mw(req, res, next);

        expect(permissionsService.getAccess).toHaveBeenCalledWith(
            42,
            'project',
            'abc123'
        );
        expect(next).toHaveBeenCalled();
    });

    it('should resolve uid from a static string', async () => {
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('ro', 'project', 'static-uid');

        await mw(req, res, next);

        expect(permissionsService.getAccess).toHaveBeenCalledWith(
            42,
            'project',
            'static-uid'
        );
        expect(next).toHaveBeenCalled();
    });

    it('should resolve uid from an async function', async () => {
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('ro', 'task', async (r) => r.params.uid);

        await mw(req, res, next);

        expect(permissionsService.getAccess).toHaveBeenCalledWith(
            42,
            'task',
            'abc123'
        );
        expect(next).toHaveBeenCalled();
    });

    it('should return 404 when uid resolves to null', async () => {
        const mw = hasAccess('ro', 'project', () => null);

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when uid resolves to undefined', async () => {
        const mw = hasAccess('ro', 'project', () => undefined);

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when uid resolves to empty string', async () => {
        const mw = hasAccess('ro', 'project', () => '');

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
    });

    // --- Permission hierarchy ---

    it('should allow access when user has exact required level (ro)', async () => {
        permissionsService.getAccess.mockResolvedValue('ro');
        const mw = hasAccess('ro', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should allow access when user has higher than required (rw > ro)', async () => {
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('ro', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should allow access when user has admin and rw is required', async () => {
        permissionsService.getAccess.mockResolvedValue('admin');
        const mw = hasAccess('rw', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should deny access when user has ro but rw is required', async () => {
        permissionsService.getAccess.mockResolvedValue('ro');
        const mw = hasAccess('rw', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user has none', async () => {
        permissionsService.getAccess.mockResolvedValue('none');
        const mw = hasAccess('ro', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
        expect(next).not.toHaveBeenCalled();
    });

    // --- User ID extraction ---

    it('should prefer currentUser.id over session.userId', async () => {
        req.currentUser = { id: 100 };
        req.session = { userId: 200 };
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('ro', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(permissionsService.getAccess).toHaveBeenCalledWith(
            100,
            'project',
            'uid1'
        );
    });

    it('should fall back to session.userId when currentUser is missing', async () => {
        req.currentUser = null;
        req.session = { userId: 200 };
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('ro', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(permissionsService.getAccess).toHaveBeenCalledWith(
            200,
            'project',
            'uid1'
        );
    });

    // --- Options ---

    it('should use custom notFoundMessage', async () => {
        const mw = hasAccess('ro', 'project', () => null, {
            notFoundMessage: 'Project not found',
        });

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('should return 404 instead of 403 when forbiddenStatus is 404', async () => {
        permissionsService.getAccess.mockResolvedValue('none');
        const mw = hasAccess('rw', 'project', () => 'uid1', {
            forbiddenStatus: 404,
        });

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('should use custom notFoundMessage with forbiddenStatus 404', async () => {
        permissionsService.getAccess.mockResolvedValue('none');
        const mw = hasAccess('rw', 'project', () => 'uid1', {
            forbiddenStatus: 404,
            notFoundMessage: 'Task not found',
        });

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Task not found' });
    });

    // --- Resource types ---

    it('should pass correct resource type for tasks', async () => {
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('rw', 'task', () => 'task-uid');

        await mw(req, res, next);

        expect(permissionsService.getAccess).toHaveBeenCalledWith(
            42,
            'task',
            'task-uid'
        );
    });

    it('should pass correct resource type for notes', async () => {
        permissionsService.getAccess.mockResolvedValue('rw');
        const mw = hasAccess('rw', 'note', () => 'note-uid');

        await mw(req, res, next);

        expect(permissionsService.getAccess).toHaveBeenCalledWith(
            42,
            'note',
            'note-uid'
        );
    });

    // --- Error handling ---

    it('should forward errors from getAccess to next()', async () => {
        const error = new Error('Database failure');
        permissionsService.getAccess.mockRejectedValue(error);
        const mw = hasAccess('ro', 'project', () => 'uid1');

        await mw(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should forward errors from getResourceUid to next()', async () => {
        const error = new Error('UID lookup failed');
        const mw = hasAccess('ro', 'project', () => {
            throw error;
        });

        await mw(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
        expect(res.status).not.toHaveBeenCalled();
    });
});
