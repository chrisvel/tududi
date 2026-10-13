const {
    Project,
    Task,
    Note,
    Area,
    Goal,
    Person,
    User,
} = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const permissionSources = require('../../../services/permissionSources');

const { getAccess, resourceExists, ownershipOrPermissionWhere, ACCESS } =
    permissionsService;

const ME = 1;

// The ways getAccess answers "none" or walks further that the integration
// tests do not reach: rows that are gone, parents that are gone, tasks
// assigned to someone else, and resource types it does not know.
describe('permissionsService edge cases', () => {
    beforeEach(() => {
        jest.spyOn(
            permissionSources,
            'findAcceptedAccessLevel'
        ).mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('resourceExists', () => {
        it('is false for an unknown type or a missing uid', async () => {
            expect(await resourceExists('habit', 'x')).toBe(false);
            expect(await resourceExists('task', '')).toBe(false);
        });
    });

    describe('getAccess on tasks', () => {
        it('gives nothing for a task assigned to someone else', async () => {
            jest.spyOn(Task, 'findOne').mockResolvedValue({
                user_id: 2,
                assigned_to: 'their-person',
                project_id: null,
                parent_task_id: null,
            });
            jest.spyOn(Person, 'findAll').mockResolvedValue([
                { uid: 'my-person' },
            ]);

            expect(await getAccess(ME, 'task', 't1')).toBe(ACCESS.NONE);
        });

        it('stops walking up when a parent task is gone', async () => {
            jest.spyOn(Task, 'findOne')
                .mockResolvedValueOnce({
                    user_id: 2,
                    project_id: null,
                    parent_task_id: 10,
                })
                .mockResolvedValueOnce(null);

            expect(await getAccess(ME, 'task', 't1')).toBe(ACCESS.NONE);
        });

        it("gives full access inside the caller's own parent task", async () => {
            jest.spyOn(Task, 'findOne')
                .mockResolvedValueOnce({
                    user_id: 2,
                    project_id: null,
                    parent_task_id: 10,
                })
                .mockResolvedValueOnce({
                    user_id: ME,
                    project_id: null,
                    parent_task_id: null,
                });

            expect(await getAccess(ME, 'task', 't1')).toBe(ACCESS.RW);
        });

        it('gives nothing when the project of the task is gone', async () => {
            jest.spyOn(Task, 'findOne').mockResolvedValue({
                user_id: 2,
                project_id: 5,
                parent_task_id: null,
            });
            jest.spyOn(Project, 'findOne').mockResolvedValue(null);

            expect(await getAccess(ME, 'task', 't1')).toBe(ACCESS.NONE);
        });
    });

    describe('getAccess on notes', () => {
        it('gives nothing for a missing note', async () => {
            jest.spyOn(Note, 'findOne').mockResolvedValue(null);
            expect(await getAccess(ME, 'note', 'n1')).toBe(ACCESS.NONE);
        });

        it('gives nothing when the project of the note is gone', async () => {
            jest.spyOn(Note, 'findOne').mockResolvedValue({
                user_id: 2,
                project_id: 5,
            });
            jest.spyOn(Project, 'findOne').mockResolvedValue(null);
            expect(await getAccess(ME, 'note', 'n1')).toBe(ACCESS.NONE);
        });

        it("gives nothing when the note's project is not shared", async () => {
            jest.spyOn(Note, 'findOne').mockResolvedValue({
                user_id: 2,
                project_id: 5,
            });
            jest.spyOn(Project, 'findOne')
                .mockResolvedValueOnce({ uid: 'p1' })
                .mockResolvedValueOnce({ user_id: 2 });
            expect(await getAccess(ME, 'note', 'n1')).toBe(ACCESS.NONE);
        });
    });

    describe('getAccess on areas, goals and unknown types', () => {
        it('gives nothing for a missing area', async () => {
            jest.spyOn(Area, 'findOne').mockResolvedValue(null);
            expect(await getAccess(ME, 'area', 'a1')).toBe(ACCESS.NONE);
        });

        it('gives nothing for a missing goal', async () => {
            jest.spyOn(Goal, 'findOne').mockResolvedValue(null);
            expect(await getAccess(ME, 'goal', 'g1')).toBe(ACCESS.NONE);
        });

        it('gives full access to the owner of a goal', async () => {
            jest.spyOn(Goal, 'findOne').mockResolvedValue({ user_id: ME });
            expect(await getAccess(ME, 'goal', 'g1')).toBe(ACCESS.RW);
        });

        it('only looks at shares for a type it does not own-check', async () => {
            permissionSources.findAcceptedAccessLevel.mockResolvedValue('ro');
            expect(await getAccess(ME, 'tag', 'x')).toBe('ro');
        });
    });

    describe('ownershipOrPermissionWhere', () => {
        it('accepts a uid instead of a numeric id', async () => {
            // Only the id handling is under test: PostgreSQL would refuse a
            // uid compared with the numeric user_id column of the shares.
            jest.spyOn(permissionSources, 'findAccepted').mockResolvedValue([]);
            const findByPk = jest.spyOn(User, 'findByPk');
            const where = await ownershipOrPermissionWhere('area', 'abc-uid');
            expect(findByPk).not.toHaveBeenCalled();
            expect(where).toBeDefined();
        });

        it('copes with an id that matches no account', async () => {
            jest.spyOn(User, 'findByPk').mockResolvedValue(null);
            const where = await ownershipOrPermissionWhere('area', 424242);
            expect(where).toBeDefined();
        });
    });
});
