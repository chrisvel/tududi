const request = require('supertest');
const app = require('../../app');
const {
    Role,
    Area,
    Project,
    Task,
    Notification,
    Permission,
    UserGroup,
    UserGroupMember,
    GroupPermission,
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

describe('Leaving a share (#2036)', () => {
    let owner, bob, carol;
    let ownerAgent, bobAgent, carolAgent;
    let group, project, task, area;

    const share = async (body, agents = [bobAgent]) => {
        const res = await ownerAgent
            .post('/api/shares')
            .send({ access_level: 'rw', ...body });
        expect(res.status).toBe(204);
        for (const agent of agents) await acceptAllInvitations(agent);
    };

    const leave = (agent, body) => agent.post('/api/shares/leave').send(body);

    const leftNotices = async (userId) =>
        (
            await Notification.findAll({
                where: { user_id: userId, type: 'system' },
            })
        ).filter((n) => n.data?.reason === 'share_left');

    beforeEach(async () => {
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const users = [];
        for (const name of ['owner', 'bob', 'carol']) {
            users.push(
                await createTestUser({
                    email: `${name}_${stamp}@test.com`,
                    name,
                })
            );
        }
        [owner, bob, carol] = users;
        await Role.destroy({ where: {} });
        [ownerAgent, bobAgent, carolAgent] = await Promise.all(
            [owner, bob, carol].map(login)
        );

        group = await UserGroup.create({ name: `Crew ${stamp}` });
        await UserGroupMember.create({ group_id: group.id, user_id: bob.id });
        await UserGroupMember.create({
            group_id: group.id,
            user_id: carol.id,
        });

        area = await Area.create({ name: 'Site', user_id: owner.id });
        project = await Project.create({
            name: 'Tower',
            user_id: owner.id,
            area_id: area.id,
        });
        task = await Task.create({
            name: 'Pour',
            user_id: owner.id,
            project_id: project.id,
        });
    });

    it('removes a direct project share and tells the sharer once', async () => {
        await share({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: bob.email,
        });
        const before = await bobAgent.get(`/api/project/${project.uid}`);
        expect(before.status).toBe(200);
        expect(before.body.can_leave).toBe(true);

        const res = await leave(bobAgent, {
            resource_type: 'project',
            resource_uid: project.uid,
        });
        expect(res.status).toBe(204);

        expect(await Permission.count({ where: { user_id: bob.id } })).toBe(0);
        expect(
            (await bobAgent.get(`/api/project/${project.uid}`)).status
        ).not.toBe(200);
        expect((await bobAgent.get(`/api/task/${task.uid}`)).status).toBe(403);

        const notices = await leftNotices(owner.id);
        expect(notices).toHaveLength(1);
        expect(notices[0].title).toBe('bob left a project you shared');
        expect(notices[0].data).toMatchObject({
            resourceType: 'project',
            resourceUid: project.uid,
            leftUserId: bob.id,
        });
    });

    it('does not offer leaving to the owner and refuses it', async () => {
        const detail = await ownerAgent.get(`/api/project/${project.uid}`);
        expect(detail.body.can_leave).toBe(false);

        const res = await leave(ownerAgent, {
            resource_type: 'project',
            resource_uid: project.uid,
        });
        expect(res.status).toBe(400);
    });

    it('answers 404 when nothing is shared with the user', async () => {
        const res = await leave(carolAgent, {
            resource_type: 'project',
            resource_uid: project.uid,
        });
        expect(res.status).toBe(404);
    });

    it('rejects missing or unsupported parameters', async () => {
        expect(
            (await leave(bobAgent, { resource_type: 'project' })).status
        ).toBe(400);
        expect(
            (
                await leave(bobAgent, {
                    resource_type: 'tag',
                    resource_uid: project.uid,
                })
            ).status
        ).toBe(400);
    });

    it('takes one member off a group share and keeps the others', async () => {
        await share(
            {
                resource_type: 'area',
                resource_uid: area.uid,
                target_group_uid: group.uid,
            },
            [bobAgent, carolAgent]
        );
        const areas = await bobAgent.get('/api/areas');
        expect(areas.body.find((a) => a.uid === area.uid).can_leave).toBe(true);

        const res = await leave(bobAgent, {
            resource_type: 'area',
            resource_uid: area.uid,
        });
        expect(res.status).toBe(204);

        expect(
            await GroupPermission.count({ where: { user_id: bob.id } })
        ).toBe(0);
        expect(
            await GroupPermission.count({ where: { user_id: carol.id } })
        ).toBeGreaterThan(0);
        expect(
            await UserGroupMember.count({
                where: { group_id: group.id, user_id: bob.id },
            })
        ).toBe(1);

        const after = await bobAgent.get('/api/areas');
        expect(after.body.find((a) => a.uid === area.uid)).toBeUndefined();
        expect(
            (await bobAgent.get(`/api/project/${project.uid}`)).status
        ).not.toBe(200);
        expect(
            (await carolAgent.get(`/api/project/${project.uid}`)).status
        ).toBe(200);

        const notices = await leftNotices(owner.id);
        expect(notices).toHaveLength(1);
        expect(notices[0].title).toBe('bob left an area you shared');
    });

    it('removes access held both directly and through a group', async () => {
        await share({
            resource_type: 'project',
            resource_uid: project.uid,
            target_group_uid: group.uid,
        });
        await share({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: bob.email,
        });

        const res = await leave(bobAgent, {
            resource_type: 'project',
            resource_uid: project.uid,
        });
        expect(res.status).toBe(204);

        expect(await Permission.count({ where: { user_id: bob.id } })).toBe(0);
        expect(
            await GroupPermission.count({ where: { user_id: bob.id } })
        ).toBe(0);
        expect(
            (await bobAgent.get(`/api/project/${project.uid}`)).status
        ).not.toBe(200);
        expect(await leftNotices(owner.id)).toHaveLength(1);
    });

    it('unassigns the open tasks of whoever leaves', async () => {
        const bobSelf = await peopleService.createSelfPerson(bob);
        await share({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: bob.email,
        });
        const open = await Task.create({
            name: 'Open',
            user_id: owner.id,
            project_id: project.id,
            assigned_to: bobSelf.uid,
        });
        const done = await Task.create({
            name: 'Done',
            user_id: owner.id,
            project_id: project.id,
            assigned_to: bobSelf.uid,
            status: Task.STATUS.DONE,
        });

        await leave(bobAgent, {
            resource_type: 'project',
            resource_uid: project.uid,
        });

        expect((await Task.findByPk(open.id)).assigned_to).toBeNull();
        expect((await Task.findByPk(done.id)).assigned_to).toBe(bobSelf.uid);
    });
});
