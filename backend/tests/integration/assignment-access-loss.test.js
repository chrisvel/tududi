const request = require('supertest');
const app = require('../../app');
const {
    Role,
    Area,
    Project,
    Task,
    Notification,
    UserGroup,
} = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

async function login(user) {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
}

describe('Losing access to a project unassigns its open tasks (#2017)', () => {
    let admin, owner, bob, carol;
    let adminAgent, ownerAgent, bobAgent;
    let bobSelf, group, project;

    const addToGroup = async (user, target = group) => {
        const res = await adminAgent
            .post(`/api/admin/groups/${target.uid}/members`)
            .send({ user_ids: [user.id] });
        expect(res.status).toBe(200);
    };

    const removeFromGroup = async (user, target = group) => {
        const res = await adminAgent.delete(
            `/api/admin/groups/${target.uid}/members/${user.id}`
        );
        expect(res.status).toBe(204);
    };

    const share = async (body) => {
        const res = await ownerAgent.post('/api/shares').send({
            access_level: 'rw',
            ...body,
        });
        expect([200, 201, 204]).toContain(res.status);
        await acceptAllInvitations(bobAgent);
    };

    const shareProjectWithGroup = () =>
        share({
            resource_type: 'project',
            resource_uid: project.uid,
            target_group_uid: group.uid,
        });

    const shareProjectWithBob = () =>
        share({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: bob.email,
        });

    const assignToBob = (data = {}) =>
        Task.create({
            name: 'Assigned to Bob',
            user_id: owner.id,
            project_id: project.id,
            assigned_to: bobSelf.uid,
            ...data,
        });

    const assignee = async (task) => (await Task.findByPk(task.id)).assigned_to;

    const ownerNotices = () =>
        Notification.findAll({
            where: { user_id: owner.id, type: 'system' },
        });

    beforeEach(async () => {
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const users = [];
        for (const name of ['admin', 'owner', 'bob', 'carol']) {
            users.push(
                await createTestUser({
                    email: `${name}_${stamp}@test.com`,
                    name,
                })
            );
        }
        [admin, owner, bob, carol] = users;
        await Role.destroy({ where: {} });
        await Role.create({ user_id: admin.id, is_admin: true });
        [adminAgent, ownerAgent, bobAgent] = await Promise.all(
            [admin, owner, bob].map(login)
        );

        bobSelf = await peopleService.createSelfPerson(bob);
        await peopleService.createSelfPerson(carol);

        group = await UserGroup.create({ name: `Crew ${stamp}` });
        project = await Project.create({ name: 'Tower', user_id: owner.id });
    });

    it('unassigns open tasks when the member is removed from the group', async () => {
        await addToGroup(bob);
        await shareProjectWithGroup();
        const task = await assignToBob();
        const subtask = await Task.create({
            name: 'Sub',
            user_id: owner.id,
            parent_task_id: task.id,
            assigned_to: bobSelf.uid,
        });
        expect((await bobAgent.get(`/api/task/${task.uid}`)).status).toBe(200);

        await removeFromGroup(bob);

        expect(await assignee(task)).toBeNull();
        expect(await assignee(subtask)).toBeNull();
        expect((await bobAgent.get(`/api/task/${task.uid}`)).status).toBe(403);

        const notices = await ownerNotices();
        expect(notices).toHaveLength(1);
        expect(notices[0].title).toContain('2 tasks');
        expect(notices[0].title).toContain('Tower');
        expect(notices[0].data).toMatchObject({
            reason: 'assignee_lost_access',
            projectUid: project.uid,
            count: 2,
            unassignedUserId: bob.id,
        });
    });

    it('keeps the assignment when a direct share still gives access', async () => {
        await addToGroup(bob);
        await shareProjectWithGroup();
        await shareProjectWithBob();
        const task = await assignToBob();

        await removeFromGroup(bob);

        expect(await assignee(task)).toBe(bobSelf.uid);
        expect((await bobAgent.get(`/api/task/${task.uid}`)).status).toBe(200);
        expect(await ownerNotices()).toHaveLength(0);
    });

    it('leaves completed tasks assigned', async () => {
        await addToGroup(bob);
        await shareProjectWithGroup();
        const done = await assignToBob({ status: Task.STATUS.DONE });
        const cancelled = await assignToBob({
            status: Task.STATUS.CANCELLED,
        });

        await removeFromGroup(bob);

        expect(await assignee(done)).toBe(bobSelf.uid);
        expect(await assignee(cancelled)).toBe(bobSelf.uid);
        expect(await ownerNotices()).toHaveLength(0);
    });

    it('unassigns open tasks when a direct share is revoked', async () => {
        await shareProjectWithBob();
        const task = await assignToBob();

        const res = await ownerAgent.delete('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_id: bob.id,
        });
        expect(res.status).toBe(204);

        expect(await assignee(task)).toBeNull();
        expect((await bobAgent.get(`/api/task/${task.uid}`)).status).toBe(403);
        expect(await ownerNotices()).toHaveLength(1);
    });

    it('unassigns open tasks when the group is deleted', async () => {
        await addToGroup(bob);
        await shareProjectWithGroup();
        const task = await assignToBob();

        const res = await adminAgent.delete(`/api/admin/groups/${group.uid}`);
        expect(res.status).toBe(204);

        expect(await assignee(task)).toBeNull();
        expect(await ownerNotices()).toHaveLength(1);
    });

    it('unassigns open tasks when the project is restricted out of a shared area', async () => {
        const area = await Area.create({ name: 'Sites', user_id: owner.id });
        await share({
            resource_type: 'area',
            resource_uid: area.uid,
            target_user_email: bob.email,
        });
        const created = await ownerAgent
            .post('/api/project')
            .send({ name: 'Payroll', area_id: area.id });
        expect(created.status).toBe(201);
        project = await Project.findOne({ where: { uid: created.body.uid } });
        const task = await assignToBob();

        const res = await ownerAgent
            .patch(`/api/project/${project.uid}`)
            .send({ visibility: 'restricted' });
        expect(res.status).toBe(200);

        expect(await assignee(task)).toBeNull();
        expect(await ownerNotices()).toHaveLength(1);
    });
});
