const { Op } = require('sequelize');
const { Task, Project } = require('../../../../models');
const permissionsService = require('../../../../services/permissionsService');
const {
    fetchTasksDueToday,
    fetchOverdueTasks,
} = require('../../../../modules/tasks/queries/metrics-queries');
const { createTestUser } = require('../../../helpers/testUtils');

// The shared-project condition in these queries is written as raw SQL, so
// every project uid it carries must reach the database as a quoted value.
describe('metrics queries: shared project condition', () => {
    let user;
    let project;

    beforeEach(async () => {
        user = await createTestUser({
            email: `metrics_${Date.now()}@example.com`,
        });
        const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
        project = await Project.create({
            name: 'Overdue project',
            user_id: user.id,
            due_date_at: yesterday,
        });
        await Task.create({
            name: 'Task in overdue project',
            user_id: user.id,
            project_id: project.id,
            status: Task.STATUS.NOT_STARTED,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const visibleTo = (u) => ({ user_id: u.id });

    const shareUids = (uids) =>
        jest
            .spyOn(permissionsService, 'ownershipOrPermissionWhere')
            .mockResolvedValue({
                [Op.or]: [{ uid: { [Op.in]: uids } }],
            });

    it('treats a uid containing a quote as a value, not as SQL', async () => {
        shareUids(["x') OR 1=1 --", "a'b"]);
        await expect(
            fetchOverdueTasks(visibleTo(user), 'UTC', user.id)
        ).resolves.toEqual([]);
        await expect(
            fetchTasksDueToday(visibleTo(user), 'UTC', user.id)
        ).resolves.toEqual([]);
    });

    it('still matches a real shared project uid', async () => {
        shareUids([project.uid]);
        const tasks = await fetchOverdueTasks(visibleTo(user), 'UTC', user.id);
        expect(tasks.map((t) => t.name)).toEqual(['Task in overdue project']);
    });

    it('never writes an owner id that is not a number into the query', async () => {
        jest.spyOn(
            permissionsService,
            'ownershipOrPermissionWhere'
        ).mockResolvedValue({
            [Op.or]: [{ user_id: '0 OR (SELECT' }],
        });
        // Unescaped, this is a syntax error; dropped, the query just runs.
        await expect(
            fetchOverdueTasks(visibleTo(user), 'UTC', user.id)
        ).resolves.toBeInstanceOf(Array);
    });
});
