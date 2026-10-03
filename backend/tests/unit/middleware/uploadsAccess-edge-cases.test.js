jest.mock('../../../models', () => ({
    TaskAttachment: { findOne: jest.fn() },
    InboxItemAttachment: { findOne: jest.fn() },
    ProjectAttachment: { findOne: jest.fn() },
    NoteAttachment: { findOne: jest.fn() },
    Note: {},
    Task: { count: jest.fn() },
    Project: { findAll: jest.fn() },
    User: { findOne: jest.fn() },
}));
jest.mock('../../../services/permissionsService', () => ({
    getAccess: jest.fn(),
    getMyPersonUids: jest.fn(),
}));
jest.mock('../../../services/permissionSources', () => ({
    countAccepted: jest.fn(),
    findAccepted: jest.fn(),
}));

const models = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const permissionSources = require('../../../services/permissionSources');
const {
    uploadsAccessControl,
    resolveUploadTarget,
} = require('../../../middleware/uploadsAccess');

const USER_ID = 5;

const run = async (path) => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };
    const next = jest.fn();
    await uploadsAccessControl(
        { path, session: { userId: USER_ID }, currentUser: { id: USER_ID } },
        res,
        next
    );
    return { res, next };
};

// What the middleware did: refused with 403, or passed the request on.
const outcome = ({ res, next }) => {
    if (res.status.mock.calls.some(([code]) => code === 403)) {
        return next.mock.calls.length === 0 ? 'refused' : 'both';
    }
    return next.mock.calls.length === 1 && next.mock.calls[0].length === 0
        ? 'allowed'
        : 'other';
};

// The refusals the integration tests for uploads do not reach: files that
// belong to nothing, project covers seen only through an assigned task,
// avatars of people the viewer has never worked with, and paths that try to
// escape their folder.
describe('uploadsAccessControl edge cases', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('refuses a project file that belongs to no project', async () => {
        models.ProjectAttachment.findOne.mockResolvedValue(null);
        expect(outcome(await run('/project-files/orphan.pdf'))).toBe('refused');
    });

    it('refuses a note file that belongs to no note', async () => {
        models.NoteAttachment.findOne.mockResolvedValue(null);
        expect(outcome(await run('/note-files/orphan.pdf'))).toBe('refused');
    });

    it('allows a note file the viewer can read', async () => {
        models.NoteAttachment.findOne.mockResolvedValue({
            Note: { uid: 'note1' },
        });
        permissionsService.getAccess.mockResolvedValue('ro');
        expect(outcome(await run('/note-files/mine.pdf'))).toBe('allowed');
    });

    describe('project cover images', () => {
        it('refuses an image no project uses', async () => {
            models.Project.findAll.mockResolvedValue([]);
            expect(outcome(await run('/projects/unused.png'))).toBe('refused');
        });

        it('refuses a viewer who is not a person anywhere', async () => {
            models.Project.findAll.mockResolvedValue([{ id: 1, uid: 'p1' }]);
            permissionsService.getAccess.mockResolvedValue('none');
            permissionsService.getMyPersonUids.mockResolvedValue([]);
            expect(outcome(await run('/projects/cover.png'))).toBe('refused');
            expect(models.Task.count).not.toHaveBeenCalled();
        });

        it('allows someone with a task assigned in the project', async () => {
            models.Project.findAll.mockResolvedValue([{ id: 1, uid: 'p1' }]);
            permissionsService.getAccess.mockResolvedValue('none');
            permissionsService.getMyPersonUids.mockResolvedValue(['person1']);
            models.Task.count.mockResolvedValue(1);
            expect(outcome(await run('/projects/cover.png'))).toBe('allowed');
        });

        it('refuses someone with nothing assigned in the project', async () => {
            models.Project.findAll.mockResolvedValue([{ id: 1, uid: 'p1' }]);
            permissionsService.getAccess.mockResolvedValue('none');
            permissionsService.getMyPersonUids.mockResolvedValue(['person1']);
            models.Task.count.mockResolvedValue(0);
            expect(outcome(await run('/projects/cover.png'))).toBe('refused');
        });
    });

    describe('avatars', () => {
        it('refuses an avatar nobody uses', async () => {
            models.User.findOne.mockResolvedValue(null);
            expect(outcome(await run('/avatars/nobody.png'))).toBe('refused');
        });

        it("refuses a stranger's avatar", async () => {
            models.User.findOne.mockResolvedValue({ id: 99 });
            permissionSources.countAccepted.mockResolvedValue(0);
            permissionSources.findAccepted.mockResolvedValue([]);
            expect(outcome(await run('/avatars/stranger.png'))).toBe('refused');
        });

        it('allows the avatar of someone sharing the same resource', async () => {
            models.User.findOne.mockResolvedValue({ id: 99 });
            permissionSources.countAccepted
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(1);
            permissionSources.findAccepted.mockResolvedValue([
                { resource_uid: 'shared1' },
            ]);
            expect(outcome(await run('/avatars/colleague.png'))).toBe(
                'allowed'
            );
        });

        it('refuses when the shared resources do not overlap', async () => {
            models.User.findOne.mockResolvedValue({ id: 99 });
            permissionSources.countAccepted.mockResolvedValue(0);
            permissionSources.findAccepted.mockResolvedValue([
                { resource_uid: 'mine-only' },
            ]);
            expect(outcome(await run('/avatars/other.png'))).toBe('refused');
        });
    });

    it('refuses an unknown folder', async () => {
        expect(outcome(await run('/secrets/file.txt'))).toBe('refused');
    });

    it('passes a lookup failure on to the error handler', async () => {
        const failure = new Error('database down');
        models.TaskAttachment.findOne.mockRejectedValue(failure);
        const { next } = await run('/tasks/file.pdf');
        expect(next).toHaveBeenCalledWith(failure);
    });
});

describe('resolveUploadTarget', () => {
    it.each([
        ['/tasks/bad%00name', 'a NUL byte'],
        ['/tasks/..%5Cevil', 'a backslash'],
        ['/tasks/./file', 'a dot segment'],
        ['/tasks/..', 'a parent folder as the file name'],
        ['/%2E%2E/file', 'an encoded parent folder'],
        ['/tasks/%E0%A4%A', 'broken percent encoding'],
        ['/tasks/a/b', 'too many segments'],
    ])('refuses %s (%s)', (path) => {
        expect(resolveUploadTarget(path)).toBeNull();
    });

    it('reads a plain path', () => {
        expect(resolveUploadTarget('/tasks/file.pdf')).toEqual({
            category: 'tasks',
            filename: 'file.pdf',
        });
    });
});
