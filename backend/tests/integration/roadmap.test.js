const request = require('supertest');
const app = require('../../app');
const {
    Area,
    Goal,
    Permission,
    Project,
    Task,
    UserProjectArea,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const Q4 = '/api/roadmap?from=2026-10-01&days=92';

async function login(email, timezone = 'Europe/Athens') {
    const user = await createTestUser({ email, timezone });
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password: 'password123' });
    return { user, agent };
}

async function addTask(agent, project, fields) {
    const res = await agent
        .post('/api/task')
        .send({ project_id: project.id, ...fields });
    expect(res.status).toBe(201);
    return res.body;
}

const findProject = (body, name) =>
    body.areas
        .flatMap((area) => area.projects)
        .find((project) => project.name === name);

describe('GET /api/roadmap', () => {
    let owner, agent, area, project;

    beforeEach(async () => {
        ({ user: owner, agent } = await login(
            `roadmap-${Date.now()}@example.com`
        ));
        area = await Area.create({ name: 'DST', user_id: owner.id });
        project = await Project.create({
            name: 'BIM reviews',
            user_id: owner.id,
            area_id: area.id,
        });
    });

    it('requires a session', async () => {
        const res = await request(app).get(Q4);
        expect(res.status).toBe(401);
    });

    it('rolls a project and its area up from tasks, a due date alone counting as a day', async () => {
        await addTask(agent, project, {
            name: 'Range',
            start_date: '2026-11-04',
            due_date: '2026-11-20',
        });
        await addTask(agent, project, {
            name: 'Due only',
            due_date: '2026-11-03',
        });
        await addTask(agent, project, { name: 'Undated' });

        const res = await agent.get(Q4);

        expect(res.status).toBe(200);
        expect(res.body.from).toBe('2026-10-01');
        expect(res.body.to).toBe('2026-12-31');
        const row = findProject(res.body, 'BIM reviews');
        expect(row.start).toBe('2026-11-03');
        expect(row.end).toBe('2026-11-20');
        expect(row.dated_from_tasks).toBe(true);
        expect(row.task_count).toBe(3);
        expect(row.tasks.map((task) => [task.name, task.kind])).toEqual([
            ['Range', 'range'],
            ['Due only', 'due'],
        ]);
        expect(res.body.areas[0].uid).toBe(area.uid);
        expect(res.body.areas[0].start).toBe('2026-11-03');
        expect(res.body.areas[0].end).toBe('2026-11-20');
    });

    it('counts done tasks, ignores cancelled tasks and subtasks', async () => {
        const done = await addTask(agent, project, {
            name: 'Done early',
            due_date: '2026-10-05',
        });
        const cancelled = await addTask(agent, project, {
            name: 'Cancelled',
            due_date: '2026-10-02',
        });
        const parent = await addTask(agent, project, {
            name: 'Parent',
            due_date: '2026-11-10',
        });
        await Task.update(
            { status: Task.STATUS.DONE },
            { where: { uid: done.uid } }
        );
        await Task.update(
            { status: Task.STATUS.CANCELLED },
            { where: { uid: cancelled.uid } }
        );
        await Task.create({
            name: 'Subtask',
            user_id: owner.id,
            project_id: project.id,
            parent_task_id: parent.id,
            due_date: new Date('2026-12-20T12:00:00Z'),
        });

        const res = await agent.get(Q4);

        const row = findProject(res.body, 'BIM reviews');
        expect(row.start).toBe('2026-10-05');
        expect(row.end).toBe('2026-11-10');
        expect(row.tasks.map((task) => task.name)).toEqual([
            'Done early',
            'Parent',
        ]);
    });

    it('sends only tasks in the window but keeps the full dates', async () => {
        await addTask(agent, project, {
            name: 'Spills over',
            start_date: '2026-12-20',
            due_date: '2027-01-15',
        });
        await addTask(agent, project, {
            name: 'Next quarter',
            start_date: '2027-02-01',
            due_date: '2027-02-10',
        });

        const res = await agent.get(Q4);

        const row = findProject(res.body, 'BIM reviews');
        expect(row.tasks.map((task) => task.name)).toEqual(['Spills over']);
        expect(row.start).toBe('2026-12-20');
        expect(row.end).toBe('2027-02-10');
    });

    it("falls back to the project's own dates when no task has one", async () => {
        await project.update({
            start_date_at: new Date('2026-10-28T12:00:00Z'),
            due_date_at: new Date('2026-12-01T12:00:00Z'),
        });

        const res = await agent.get(Q4);

        const row = findProject(res.body, 'BIM reviews');
        expect(row.start).toBe('2026-10-28');
        expect(row.end).toBe('2026-12-01');
        expect(row.dated_from_tasks).toBe(false);
    });

    it('hides cancelled projects and finished ones outside the window', async () => {
        await Project.create({
            name: 'Cancelled',
            user_id: owner.id,
            status: 'cancelled',
        });
        const oldDone = await Project.create({
            name: 'Finished earlier',
            user_id: owner.id,
            status: 'done',
        });
        await addTask(agent, oldDone, {
            name: 'Old',
            due_date: '2026-03-01',
        });
        const recentDone = await Project.create({
            name: 'Finished this quarter',
            user_id: owner.id,
            status: 'done',
        });
        await addTask(agent, recentDone, {
            name: 'Recent',
            due_date: '2026-10-20',
        });

        const res = await agent.get(Q4);

        expect(findProject(res.body, 'Cancelled')).toBeUndefined();
        expect(findProject(res.body, 'Finished earlier')).toBeUndefined();
        expect(findProject(res.body, 'Finished this quarter')).toBeDefined();
        expect(findProject(res.body, 'BIM reviews')).toBeDefined();
    });

    it('puts projects without an area in a last group', async () => {
        await Project.create({ name: 'Loose', user_id: owner.id });

        const res = await agent.get(Q4);

        const last = res.body.areas[res.body.areas.length - 1];
        expect(last.uid).toBeNull();
        expect(last.projects.map((row) => row.name)).toEqual(['Loose']);
    });

    it('pins goals inside the window and counts the rest', async () => {
        const goal = (title, target_date, status = 'active') =>
            Goal.create({
                title,
                target_date,
                status,
                user_id: owner.id,
                area_id: area.id,
            });
        await goal('Inside', '2026-11-13');
        await goal('Achieved', '2026-10-16', 'achieved');
        await goal('Next quarter', '2027-01-29');
        await goal('Dropped', '2026-11-20', 'dropped');
        await Goal.create({ title: 'No date', user_id: owner.id });

        const res = await agent.get(Q4);

        expect(res.body.goals.map((item) => item.title)).toEqual([
            'Achieved',
            'Inside',
        ]);
        expect(res.body.goals[0].area_uid).toBe(area.uid);
        expect(res.body.goals_outside).toBe(1);
    });

    it('narrows to one area, goals included', async () => {
        const other = await Area.create({ name: 'CDE', user_id: owner.id });
        await Project.create({
            name: 'Elsewhere',
            user_id: owner.id,
            area_id: other.id,
        });
        await Project.create({ name: 'Loose', user_id: owner.id });
        await Goal.create({
            title: 'Other goal',
            target_date: '2026-11-13',
            user_id: owner.id,
            area_id: other.id,
        });

        const res = await agent.get(`${Q4}&area_uid=${area.uid}`);

        expect(res.body.areas.map((row) => row.name)).toEqual(['DST']);
        expect(res.body.goals).toEqual([]);
    });

    it('does not show one user anything of another', async () => {
        await addTask(agent, project, {
            name: 'Private',
            due_date: '2026-11-03',
        });
        await Goal.create({
            title: 'Private goal',
            target_date: '2026-11-13',
            user_id: owner.id,
        });
        const { agent: strangerAgent } = await login(
            `roadmap-stranger-${Date.now()}@example.com`
        );

        const res = await strangerAgent.get(Q4);

        expect(res.status).toBe(200);
        expect(res.body.areas).toEqual([]);
        expect(res.body.goals).toEqual([]);

        const scoped = await strangerAgent.get(`${Q4}&area_uid=${area.uid}`);
        expect(scoped.status).toBe(404);
    });

    it('places a shared project where the member filed it', async () => {
        await addTask(agent, project, {
            name: 'Shared task',
            due_date: '2026-11-03',
        });
        const { user: member, agent: memberAgent } = await login(
            `roadmap-member-${Date.now()}@example.com`
        );
        await Permission.create({
            user_id: member.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: 'ro',
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });

        const unplaced = await memberAgent.get(Q4);
        expect(unplaced.body.areas).toHaveLength(1);
        expect(unplaced.body.areas[0].uid).toBeNull();
        expect(unplaced.body.areas[0].projects[0].tasks).toHaveLength(1);

        const own = await Area.create({ name: 'Mine', user_id: member.id });
        await UserProjectArea.create({
            user_id: member.id,
            project_id: project.id,
            area_id: own.id,
        });

        const placed = await memberAgent.get(Q4);
        expect(placed.body.areas.map((row) => row.name)).toEqual(['Mine']);
    });

    it('keeps the local day for a task near midnight', async () => {
        await Task.create({
            name: 'Late',
            user_id: owner.id,
            project_id: project.id,
            // 22:30 UTC is already 1 January 2027 in Athens
            due_date: new Date('2026-12-31T22:30:00Z'),
        });

        const res = await agent.get(Q4);

        const row = findProject(res.body, 'BIM reviews');
        expect(row.end).toBe('2027-01-01');
        expect(row.tasks).toEqual([]);
    });

    it('rejects a malformed from and clamps days', async () => {
        const bad = await agent.get('/api/roadmap?from=soon');
        expect(bad.status).toBe(400);

        const wide = await agent.get(
            '/api/roadmap?from=2026-01-01&days=100000'
        );
        expect(wide.status).toBe(200);
        expect(wide.body.to).toBe('2026-07-05');
    });

    it('defaults to the current quarter', async () => {
        const res = await agent.get('/api/roadmap');

        expect(res.status).toBe(200);
        expect(res.body.from).toMatch(/-(01|04|07|10)-01$/);
    });
});
