const request = require('supertest');
const app = require('../../app');
const { Project, Task, Area } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const daysFromNow = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
};

describe('GET /api/everyone', () => {
    let owner, mate, ownerAgent, mateAgent, ownerSelf, mateSelf, area, project;

    beforeEach(async () => {
        owner = await createTestUser({
            email: `evowner_${Date.now()}@example.com`,
            name: 'Owner',
        });
        mate = await createTestUser({
            email: `evmate_${Date.now()}@example.com`,
            name: 'Mate',
        });
        ownerSelf = await peopleService.createSelfPerson(owner);
        mateSelf = await peopleService.createSelfPerson(mate);

        ownerAgent = await login(owner);
        mateAgent = await login(mate);

        area = await Area.create({ name: 'Home', user_id: owner.id });
        project = await Project.create({
            name: 'Renovation',
            user_id: owner.id,
            area_id: area.id,
        });

        await ownerAgent.post('/api/shares').send({
            resource_type: 'area',
            resource_uid: area.uid,
            target_user_email: mate.email,
            access_level: 'rw',
        });
        await acceptAllInvitations(mateAgent);
    });

    it("shows a collaborator's task in a shared project under their column", async () => {
        await Task.create({
            name: 'Grout the tiles',
            user_id: mate.id,
            project_id: project.id,
            due_date: new Date(),
        });

        const res = await ownerAgent.get('/api/everyone');
        expect(res.status).toBe(200);

        const mateColumn = res.body.columns.find(
            (c) => c.person.uid === mateSelf.uid
        );
        expect(mateColumn).toBeDefined();
        expect(
            mateColumn.today.find((t) => t.name === 'Grout the tiles')
        ).toBeDefined();
    });

    it('groups a task by its assignee, not its creator', async () => {
        await Task.create({
            name: 'Drive to tennis',
            user_id: owner.id,
            project_id: project.id,
            assigned_to: mateSelf.uid,
            due_date: new Date(),
        });

        const res = await ownerAgent.get('/api/everyone');
        const mateColumn = res.body.columns.find(
            (c) => c.person.uid === mateSelf.uid
        );
        expect(
            mateColumn.today.find((t) => t.name === 'Drive to tennis')
        ).toBeDefined();
        const ownerColumn = res.body.columns.find((c) => c.is_self);
        expect(
            ownerColumn.today.find((t) => t.name === 'Drive to tennis')
        ).toBeUndefined();
    });

    it('does not expose a private task in an unshared project', async () => {
        const priv = await Project.create({
            name: 'Mate private',
            user_id: mate.id,
        });
        await Task.create({
            name: 'Secret errand',
            user_id: mate.id,
            project_id: priv.id,
            due_date: new Date(),
        });

        const res = await ownerAgent.get('/api/everyone');
        const allTasks = res.body.columns.flatMap((c) => [
            ...c.overdue,
            ...c.today,
            ...c.tomorrow,
            ...c.upcoming,
            ...c.no_date,
        ]);
        expect(
            allTasks.find((t) => t.name === 'Secret errand')
        ).toBeUndefined();
    });

    it('buckets tasks by due date in the viewer timezone', async () => {
        const mk = (name, due) =>
            Task.create({
                name,
                user_id: owner.id,
                project_id: project.id,
                due_date: due,
            });
        await mk('was due', daysFromNow(-2));
        await mk('due today', new Date());
        await mk('due soon', daysFromNow(3));
        await mk('no date task', null);

        const res = await ownerAgent.get('/api/everyone');
        const col = res.body.columns.find((c) => c.is_self);
        expect(col.overdue.some((t) => t.name === 'was due')).toBe(true);
        expect(col.today.some((t) => t.name === 'due today')).toBe(true);
        expect(col.upcoming.some((t) => t.name === 'due soon')).toBe(true);
        expect(col.no_date.some((t) => t.name === 'no date task')).toBe(true);
    });

    it('returns just the caller column for a user with no shares', async () => {
        const solo = await createTestUser({
            email: `evsolo_${Date.now()}@example.com`,
        });
        await peopleService.createSelfPerson(solo);
        const soloAgent = await login(solo);

        const res = await soloAgent.get('/api/everyone');
        expect(res.status).toBe(200);
        expect(res.body.columns).toHaveLength(1);
        expect(res.body.columns[0].is_self).toBe(true);
    });
});

describe('current_user has_collaborators', () => {
    it('flips to true once a share is accepted', async () => {
        const a = await createTestUser({
            email: `hca_${Date.now()}@example.com`,
        });
        const b = await createTestUser({
            email: `hcb_${Date.now()}@example.com`,
        });
        const aAgent = await login(a);
        const bAgent = await login(b);

        const before = await aAgent.get('/api/current_user');
        expect(before.body.user.has_collaborators).toBe(false);

        const project = await Project.create({ name: 'P', user_id: a.id });
        await aAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: b.email,
            access_level: 'ro',
        });
        await acceptAllInvitations(bAgent);

        const after = await aAgent.get('/api/current_user');
        expect(after.body.user.has_collaborators).toBe(true);
        const bAfter = await bAgent.get('/api/current_user');
        expect(bAfter.body.user.has_collaborators).toBe(true);
    });
});
