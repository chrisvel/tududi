const { Project, Task, Note, Area, Goal } = require('../../../models');
const calculators = require('../../../services/permissionsCalculators');

const ctx = { tx: null };
const grant = (resourceUid) => ({
    verb: 'share_grant',
    resourceUid,
    targetUserId: 2,
    actorUserId: 1,
    accessLevel: 'ro',
});
const revoke = (resourceUid) => ({
    verb: 'share_revoke',
    resourceUid,
    targetUserId: 2,
    actorUserId: 1,
});
const other = (resourceUid) => ({
    verb: 'something_else',
    resourceUid,
    targetUserId: 2,
});

// Children of a task, by parent id, for the mocked Task.findAll.
const taskTree = (byParent, extra = {}) =>
    jest.spyOn(Task, 'findAll').mockImplementation(async ({ where }) => {
        if ('project_id' in where) return extra.projectTasks || [];
        if ('goal_id' in where) return extra.goalTasks || [];
        return byParent[where.parent_task_id] || [];
    });

// What a share writes for each resource: rows that are gone, revokes of
// tasks, notes, areas and goals, subtasks met twice, and verbs the
// calculators do not handle.
describe('permission calculators edge cases', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns nothing for rows that are gone', async () => {
        jest.spyOn(Project, 'findOne').mockResolvedValue(null);
        jest.spyOn(Task, 'findOne').mockResolvedValue(null);
        jest.spyOn(Area, 'findOne').mockResolvedValue(null);
        jest.spyOn(Goal, 'findOne').mockResolvedValue(null);
        const empty = { upserts: [], deletes: [] };

        expect(
            await calculators.calculateProjectPerms(ctx, grant('p'))
        ).toEqual(empty);
        expect(await calculators.calculateTaskPerms(ctx, grant('t'))).toEqual(
            empty
        );
        expect(await calculators.calculateAreaPerms(ctx, grant('a'))).toEqual(
            empty
        );
        expect(await calculators.calculateGoalPerms(ctx, grant('g'))).toEqual(
            empty
        );
        expect(await calculators.calculateTagPerms()).toEqual(empty);
    });

    it('collects every subtask of a project once', async () => {
        taskTree(
            {
                1: [{ id: 2, uid: 'child' }],
                2: [{ id: 1, uid: 'root' }],
            },
            { projectTasks: [{ id: 1, uid: 'root', parent_task_id: null }] }
        );
        jest.spyOn(Note, 'findAll').mockResolvedValue([{ uid: 'note' }]);

        const result = await calculators.collectProjectDescendants(9);

        expect(result.taskUids.sort()).toEqual(['child', 'root']);
        expect(result.noteUids).toEqual(['note']);
    });

    it('revokes a task and its subtasks, each once', async () => {
        jest.spyOn(Task, 'findOne').mockResolvedValue({ id: 1 });
        taskTree({
            1: [
                { id: 2, uid: 'sub' },
                { id: 2, uid: 'sub' },
            ],
        });

        const changes = await calculators.calculateTaskPerms(ctx, revoke('t'));

        expect(changes.deletes.map((d) => d.resourceUid).sort()).toEqual([
            'sub',
            't',
        ]);
    });

    it('marks subtasks of a shared task as inherited', async () => {
        jest.spyOn(Task, 'findOne').mockResolvedValue({ id: 1 });
        taskTree({ 1: [{ id: 2, uid: 'sub' }] });

        const changes = await calculators.calculateTaskPerms(ctx, grant('t'));

        expect(
            Object.fromEntries(
                changes.upserts.map((u) => [u.resourceUid, u.propagation])
            )
        ).toEqual({ t: 'direct', sub: 'inherited' });
    });

    it('starts a goal task walk from the tasks alone when it has no uid', async () => {
        jest.spyOn(Goal, 'findOne').mockResolvedValue({
            id: 1,
            uid: 'g',
            user_id: 1,
        });
        jest.spyOn(Project, 'findAll').mockResolvedValue([]);
        taskTree(
            { 5: [{ id: 6, uid: 'sub' }] },
            { goalTasks: [{ id: 5, uid: null }] }
        );

        const changes = await calculators.calculateGoalPerms(ctx, grant('g'));

        expect(changes.upserts.map((u) => u.resourceUid)).toEqual(['g', 'sub']);
    });

    it('revokes a note', async () => {
        const changes = await calculators.calculateNotePerms(ctx, revoke('n'));
        expect(changes.deletes).toEqual([
            { userId: 2, resourceType: 'note', resourceUid: 'n' },
        ]);
    });

    it('revokes an area', async () => {
        jest.spyOn(Area, 'findOne').mockResolvedValue({
            id: 1,
            uid: 'a',
            user_id: 1,
        });
        jest.spyOn(Project, 'findAll').mockResolvedValue([]);

        const changes = await calculators.calculateAreaPerms(ctx, revoke('a'));

        expect(changes.deletes).toEqual([
            { userId: 2, resourceType: 'area', resourceUid: 'a' },
        ]);
    });

    it('revokes the tasks attached straight to a goal', async () => {
        jest.spyOn(Goal, 'findOne').mockResolvedValue({
            id: 1,
            uid: 'g',
            user_id: 1,
        });
        jest.spyOn(Project, 'findAll').mockResolvedValue([]);
        taskTree({}, { goalTasks: [{ id: 5, uid: 'goal-task' }] });

        const changes = await calculators.calculateGoalPerms(ctx, revoke('g'));

        expect(changes.deletes.map((d) => d.resourceUid)).toEqual([
            'g',
            'goal-task',
        ]);
    });

    it('writes nothing for a verb it does not handle', async () => {
        jest.spyOn(Task, 'findOne').mockResolvedValue({ id: 1 });
        jest.spyOn(Area, 'findOne').mockResolvedValue({
            id: 1,
            uid: 'a',
            user_id: 1,
        });
        jest.spyOn(Project, 'findAll').mockResolvedValue([]);
        taskTree({});
        const empty = { upserts: [], deletes: [] };

        expect(await calculators.calculateTaskPerms(ctx, other('t'))).toEqual(
            empty
        );
        expect(await calculators.calculateNotePerms(ctx, other('n'))).toEqual(
            empty
        );
        expect(await calculators.calculateAreaPerms(ctx, other('a'))).toEqual(
            empty
        );

        jest.spyOn(Note, 'findAll').mockResolvedValue([]);
        const changes = { upserts: [], deletes: [] };
        await calculators.projectSubtreeChanges(
            changes,
            { id: 3, uid: 'p' },
            other('p'),
            'direct'
        );
        expect(changes).toEqual(empty);
    });
});
