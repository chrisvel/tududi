const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { Task, Project, User, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const DAY = 24 * 60 * 60 * 1000;

describe('Plan my day suggestion settings', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'suggest@example.com',
            timezone: 'Europe/Athens',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'suggest@example.com',
            password: 'password123',
        });
    });

    const makeProject = (name, status = 'in_progress') =>
        Project.create({ name, status, user_id: user.id });

    const makeTask = (attrs = {}) =>
        Task.create({ name: 'A task', user_id: user.id, ...attrs });

    // Sequelize sets the timestamps itself, so tests move them afterwards.
    const setTimes = (task, { created, updated }) =>
        sequelize.query(
            'UPDATE tasks SET created_at = :created, updated_at = :updated WHERE id = :id',
            {
                replacements: {
                    id: task.id,
                    created: created ?? updated,
                    updated: updated ?? created,
                },
            }
        );

    const saveSettings = (body) =>
        agent.put('/api/daily-plan/suggestions').send(body);

    const candidates = async () => {
        const res = await agent.get('/api/daily-plan/candidates');
        expect(res.status).toBe(200);
        return res.body;
    };

    const names = (tasks) => tasks.map((task) => task.name);

    describe('settings endpoint', () => {
        it('returns the defaults and the allowed values', async () => {
            const res = await agent.get('/api/daily-plan/suggestions');

            expect(res.status).toBe(200);
            expect(res.body.settings).toEqual({
                projectStatuses: ['in_progress'],
                includeNoProject: true,
                excludedProjectIds: [],
                tieBreak: 'recently_touched',
                staleAfterDays: null,
                horizonDays: 3,
                maxSuggestions: 20,
            });
            expect(res.body.options.horizonDays).toEqual([1, 3, 7]);
            expect(res.body.options.maxSuggestions).toEqual([10, 20, 50]);
            expect(res.body.options.projectStatuses).toContain('planned');
        });

        it('saves a partial update and keeps the candidate order', async () => {
            const order = [
                'suggested:none',
                'suggested:project',
                'overdue:project',
                'overdue:none',
                'due_today:project',
                'due_today:none',
                'in_progress:project',
                'in_progress:none',
            ];
            await agent.put('/api/daily-plan/ranking').send({ order });

            const res = await saveSettings({
                tieBreak: 'oldest',
                maxSuggestions: 50,
            });

            expect(res.status).toBe(200);
            expect(res.body.settings.tieBreak).toBe('oldest');
            expect(res.body.settings.maxSuggestions).toBe(50);
            expect(res.body.settings.horizonDays).toBe(3);
            const ranking = await agent.get('/api/daily-plan/ranking');
            expect(ranking.body.order).toEqual(order);
        });

        it('rejects unknown settings and values without storing them', async () => {
            expect((await saveSettings({ colour: 'red' })).status).toBe(400);
            expect((await saveSettings({ tieBreak: 'random' })).status).toBe(
                400
            );
            expect((await saveSettings({ horizonDays: 5 })).status).toBe(400);
            expect(
                (await saveSettings({ projectStatuses: ['parked'] })).status
            ).toBe(400);

            const res = await agent.get('/api/daily-plan/suggestions');
            expect(res.body.settings.tieBreak).toBe('recently_touched');
            expect(res.body.settings.horizonDays).toBe(3);
        });

        it('rejects excluding a project the user cannot see', async () => {
            const other = await createTestUser({
                email: 'someone-else@example.com',
            });
            const theirs = await Project.create({
                name: 'Theirs',
                user_id: other.id,
            });
            const mine = await makeProject('Mine');

            expect(
                (await saveSettings({ excludedProjectIds: [theirs.id] })).status
            ).toBe(400);
            const res = await saveSettings({ excludedProjectIds: [mine.id] });
            expect(res.status).toBe(200);
            expect(res.body.settings.excludedProjectIds).toEqual([mine.id]);
        });

        it('falls back to defaults for a hand-edited setting', async () => {
            await User.update(
                {
                    ui_settings: {
                        planning: {
                            candidateOrder: ['suggested:none'],
                            tieBreak: 'random',
                            maxSuggestions: 999,
                        },
                    },
                },
                { where: { id: user.id } }
            );

            const res = await agent.get('/api/daily-plan/suggestions');
            expect(res.body.settings.tieBreak).toBe('recently_touched');
            expect(res.body.settings.maxSuggestions).toBe(20);
        });
    });

    describe('the cap', () => {
        // 60 undated tasks without priority, spread over six projects and
        // created round-robin, so no project is newer than another.
        const makeSixtyTasks = async () => {
            const projects = [];
            for (let i = 0; i < 6; i++) {
                projects.push(await makeProject(`Project ${i + 1}`));
            }
            for (let n = 0; n < 10; n++) {
                for (const project of projects) {
                    await makeTask({
                        name: `${project.name} task ${n + 1}`,
                        project_id: project.id,
                    });
                }
            }
            return projects;
        };

        const projectsIn = (tasks) =>
            new Set(tasks.map((task) => task.project_id ?? task.Project?.id));

        it('shows every project and stops at the default of 20', async () => {
            const projects = await makeSixtyTasks();

            const body = await candidates();

            expect(body.suggested).toHaveLength(20);
            expect(projectsIn(body.suggested).size).toBe(projects.length);
            expect(
                body.ranked.filter((uid) =>
                    body.suggested.some((task) => task.uid === uid)
                )
            ).toHaveLength(20);
        });

        it('respects a larger cap without dropping a project', async () => {
            const projects = await makeSixtyTasks();
            await saveSettings({ maxSuggestions: 50 });

            const body = await candidates();

            expect(body.suggested).toHaveLength(50);
            expect(projectsIn(body.suggested).size).toBe(projects.length);
        });

        it('applies the cap to the suggested group only', async () => {
            await makeSixtyTasks();
            const late = moment().subtract(3, 'days').toDate();
            for (let i = 0; i < 12; i++) {
                await makeTask({ name: `Late ${i}`, due_date: late });
            }
            await saveSettings({ maxSuggestions: 10 });

            const body = await candidates();

            expect(body.overdue).toHaveLength(12);
            expect(body.suggested).toHaveLength(10);
            expect(body.ranked).toHaveLength(22);
        });
    });

    describe('project filters', () => {
        let active, planned, excluded;

        beforeEach(async () => {
            active = await makeProject('Active');
            planned = await makeProject('Planned', 'planned');
            excluded = await makeProject('Excluded');
            await makeTask({ name: 'Active task', project_id: active.id });
            await makeTask({ name: 'Planned task', project_id: planned.id });
            await makeTask({ name: 'Loose task' });
            await makeTask({ name: 'Excluded task', project_id: excluded.id });
        });

        it('suggests tasks from in-progress projects and no project by default', async () => {
            const body = await candidates();

            expect(names(body.suggested)).toEqual(
                expect.arrayContaining([
                    'Active task',
                    'Loose task',
                    'Excluded task',
                ])
            );
            expect(names(body.suggested)).not.toContain('Planned task');
        });

        it('follows the chosen statuses and the no-project switch', async () => {
            await saveSettings({
                projectStatuses: ['planned'],
                includeNoProject: false,
            });

            const body = await candidates();

            expect(names(body.suggested)).toEqual(['Planned task']);
        });

        it('never suggests an excluded project but still shows its due and started work', async () => {
            const athens = moment.tz('Europe/Athens');
            await makeTask({
                name: 'Excluded overdue',
                project_id: excluded.id,
                due_date: athens.clone().subtract(2, 'days').toDate(),
            });
            await makeTask({
                name: 'Excluded due today',
                project_id: excluded.id,
                due_date: athens
                    .clone()
                    .endOf('day')
                    .subtract(1, 'hour')
                    .toDate(),
            });
            await makeTask({
                name: 'Excluded started',
                project_id: excluded.id,
                status: Task.STATUS.IN_PROGRESS,
            });
            await saveSettings({
                excludedProjectIds: [excluded.id],
                projectStatuses: [],
                includeNoProject: false,
            });

            const body = await candidates();

            expect(body.suggested).toEqual([]);
            expect(names(body.overdue)).toContain('Excluded overdue');
            expect(names(body.due_today)).toContain('Excluded due today');
            expect(names(body.in_progress)).toContain('Excluded started');
        });

        it('filters tasks that only reached the list through a late project', async () => {
            const lateProject = await Project.create({
                name: 'Late planned project',
                status: 'planned',
                user_id: user.id,
                due_date_at: moment().subtract(5, 'days').toDate(),
            });
            await makeTask({
                name: 'Undated in late project',
                project_id: lateProject.id,
            });

            let body = await candidates();
            expect(names(body.suggested)).not.toContain(
                'Undated in late project'
            );

            await saveSettings({ projectStatuses: ['planned'] });
            body = await candidates();
            expect(names(body.suggested)).toContain('Undated in late project');
        });
    });

    describe('tie-break', () => {
        beforeEach(async () => {
            const project = await makeProject('Home');
            const now = Date.now();
            const task = (name) => makeTask({ name, project_id: project.id });
            await setTimes(await task('Old, touched today'), {
                created: new Date(now - 300 * DAY),
                updated: new Date(now - 1000),
            });
            await setTimes(await task('New, touched last week'), {
                created: new Date(now - 10 * DAY),
                updated: new Date(now - 7 * DAY),
            });
            await setTimes(await task('Middle, untouched'), {
                created: new Date(now - 100 * DAY),
                updated: new Date(now - 100 * DAY),
            });
        });

        it.each([
            [
                'recently_touched',
                [
                    'Old, touched today',
                    'New, touched last week',
                    'Middle, untouched',
                ],
            ],
            [
                'newest',
                [
                    'New, touched last week',
                    'Middle, untouched',
                    'Old, touched today',
                ],
            ],
            [
                'oldest',
                [
                    'Old, touched today',
                    'Middle, untouched',
                    'New, touched last week',
                ],
            ],
        ])('orders ties by %s', async (tieBreak, expected) => {
            await saveSettings({ tieBreak });

            const body = await candidates();

            expect(names(body.suggested)).toEqual(expected);
            const byUid = new Map(
                body.suggested.map((task) => [task.uid, task.name])
            );
            expect(
                body.ranked
                    .filter((uid) => byUid.has(uid))
                    .map((uid) => byUid.get(uid))
            ).toEqual(expected);
        });
    });

    describe('stale and horizon filters', () => {
        it('leaves out untouched tasks after the chosen limit', async () => {
            const now = Date.now();
            await makeTask({ name: 'Fresh' });
            await setTimes(await makeTask({ name: '100 days' }), {
                updated: new Date(now - 100 * DAY),
            });
            await setTimes(await makeTask({ name: '200 days' }), {
                updated: new Date(now - 200 * DAY),
            });

            expect(names((await candidates()).suggested)).toHaveLength(3);

            await saveSettings({ staleAfterDays: 180 });
            expect(names((await candidates()).suggested).sort()).toEqual([
                '100 days',
                'Fresh',
            ]);

            await saveSettings({ staleAfterDays: 90 });
            expect(names((await candidates()).suggested)).toEqual(['Fresh']);
        });

        it('only suggests tasks due within the chosen horizon', async () => {
            const dueIn = (days) => moment().add(days, 'days').toDate();
            await makeTask({ name: 'Undated' });
            await makeTask({ name: 'In 2 days', due_date: dueIn(2) });
            await makeTask({ name: 'In 5 days', due_date: dueIn(5) });
            await makeTask({ name: 'In 10 days', due_date: dueIn(10) });

            const suggested = async () =>
                names((await candidates()).suggested).sort();

            expect(await suggested()).toEqual(['In 2 days', 'Undated']);

            await saveSettings({ horizonDays: 1 });
            expect(await suggested()).toEqual(['Undated']);

            await saveSettings({ horizonDays: 7 });
            expect(await suggested()).toEqual([
                'In 2 days',
                'In 5 days',
                'Undated',
            ]);
        });
    });
});
