const request = require('supertest');
const app = require('../../app');
const {
    Role,
    Project,
    Task,
    Area,
    Notification,
    Permission,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    syncProjectSharesFromContainer,
} = require('../../services/containerShareSync');

async function login(user) {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
}

describe('Group membership and access', () => {
    let admin, owner, alice, bob;
    let adminAgent, ownerAgent, aliceAgent, bobAgent;
    let group, project, task;

    const addMembers = (users, target = group) =>
        adminAgent
            .post(`/api/admin/groups/${target.uid}/members`)
            .send({ user_ids: users.map((u) => u.id) });

    const removeMember = (user, target = group) =>
        adminAgent.delete(`/api/admin/groups/${target.uid}/members/${user.id}`);

    const shareProject = (target = group, level = 'rw') =>
        ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_group_uid: target.uid,
            access_level: level,
        });

    const invitationsFor = async (agent) =>
        (await agent.get('/api/shares/invitations')).body.invitations;

    const accept = async (agent) => {
        for (const invitation of await invitationsFor(agent)) {
            await agent.post(`/api/shares/invitations/${invitation.id}/accept`);
        }
    };

    const canRead = async (agent) =>
        (await agent.get(`/api/project/${project.uid}`)).status === 200;

    const groupInvitationNotifications = (user) =>
        Notification.count({
            where: { user_id: user.id, type: 'share_invitation' },
        });

    beforeEach(async () => {
        const stamp = Date.now();
        const users = [];
        for (const name of ['admin', 'owner', 'alice', 'bob']) {
            users.push(
                await createTestUser({
                    email: `${name}_${stamp}@test.com`,
                    name,
                })
            );
        }
        [admin, owner, alice, bob] = users;
        await Role.destroy({ where: {} });
        await Role.create({ user_id: admin.id, is_admin: true });
        [adminAgent, ownerAgent, aliceAgent, bobAgent] = await Promise.all(
            [admin, owner, alice, bob].map(login)
        );

        group = await UserGroup.create({ name: 'Family' });
        project = await Project.create({ name: 'Shared', user_id: owner.id });
        task = await Task.create({
            name: 'Task',
            user_id: owner.id,
            project_id: project.id,
        });
    });

    describe('adding a member', () => {
        it('invites the new member to everything already shared with the group', async () => {
            await shareProject();
            const res = await addMembers([alice]);
            expect(res.status).toBe(200);
            expect(res.body.added).toEqual([alice.id]);

            const invitations = await invitationsFor(aliceAgent);
            expect(invitations).toHaveLength(1);
            expect(invitations[0]).toMatchObject({
                resource_uid: project.uid,
                via_group: { uid: group.uid },
            });
            expect(await groupInvitationNotifications(alice)).toBe(1);
            expect(await canRead(aliceAgent)).toBe(false);

            await accept(aliceAgent);
            expect(await canRead(aliceAgent)).toBe(true);
            expect((await aliceAgent.get(`/api/task/${task.uid}`)).status).toBe(
                200
            );
        });

        it('covers every grant the group holds', async () => {
            const second = await Project.create({
                name: 'Second',
                user_id: owner.id,
            });
            await shareProject();
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: second.uid,
                target_group_uid: group.uid,
                access_level: 'ro',
            });

            await addMembers([alice]);

            const invitations = await invitationsFor(aliceAgent);
            expect(invitations.map((i) => i.resource_uid).sort()).toEqual(
                [project.uid, second.uid].sort()
            );
            expect(await groupInvitationNotifications(alice)).toBe(2);
        });

        it('adds a member to a group with no grants without side effects', async () => {
            await addMembers([alice]);
            expect(await GroupPermission.count()).toBe(0);
            expect(await groupInvitationNotifications(alice)).toBe(0);
            expect(
                await UserGroupMember.count({
                    where: { group_id: group.id, user_id: alice.id },
                })
            ).toBe(1);
        });

        it('does not duplicate rows or invitations when added twice', async () => {
            await shareProject();
            await addMembers([alice]);
            const rows = await GroupPermission.count();
            await addMembers([alice]);

            expect(await GroupPermission.count()).toBe(rows);
            expect(await groupInvitationNotifications(alice)).toBe(1);
        });

        it('accepts silently when the member already holds that access', async () => {
            await Permission.create({
                user_id: alice.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
                status: 'accepted',
            });
            await shareProject(group, 'ro');

            await addMembers([alice]);

            const row = await GroupPermission.findOne({
                where: { user_id: alice.id, resource_type: 'project' },
            });
            expect(row.status).toBe('accepted');
            expect(await groupInvitationNotifications(alice)).toBe(0);
        });

        it('skips a member who owns the shared resource', async () => {
            await shareProject();
            await addMembers([owner]);
            expect(
                await GroupPermission.count({ where: { user_id: owner.id } })
            ).toBe(0);
            expect(
                await UserGroupMember.count({
                    where: { group_id: group.id, user_id: owner.id },
                })
            ).toBe(1);
        });

        it('leaves the group unchanged when the request is invalid', async () => {
            await shareProject();
            const res = await addMembers([alice, { id: 999999 }]);
            expect(res.status).toBe(400);
            expect(await UserGroupMember.count()).toBe(0);
            expect(await GroupPermission.count()).toBe(0);
        });

        it('invites again after a member declined and was re-added', async () => {
            await addMembers([alice]);
            await shareProject();
            const [invitation] = await invitationsFor(aliceAgent);
            await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/decline`
            );
            expect(await invitationsFor(aliceAgent)).toHaveLength(0);

            await removeMember(alice);
            await addMembers([alice]);

            expect(await invitationsFor(aliceAgent)).toHaveLength(1);
        });
    });

    describe('removing a member', () => {
        it('takes away access that came through the group', async () => {
            await addMembers([alice, bob]);
            await shareProject();
            await accept(aliceAgent);
            await accept(bobAgent);

            const res = await removeMember(alice);
            expect(res.status).toBe(204);

            expect(await canRead(aliceAgent)).toBe(false);
            expect((await aliceAgent.get(`/api/task/${task.uid}`)).status).toBe(
                403
            );
            expect(
                await GroupPermission.count({ where: { user_id: alice.id } })
            ).toBe(0);
            expect(await canRead(bobAgent)).toBe(true);
        });

        it('withdraws a pending invitation', async () => {
            await addMembers([alice]);
            await shareProject();
            expect(await invitationsFor(aliceAgent)).toHaveLength(1);

            await removeMember(alice);
            expect(await invitationsFor(aliceAgent)).toHaveLength(0);
        });

        it('keeps access from a direct share', async () => {
            await addMembers([alice]);
            await shareProject(group, 'ro');
            await accept(aliceAgent);
            await Permission.create({
                user_id: alice.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
                status: 'accepted',
            });

            await removeMember(alice);
            expect(await canRead(aliceAgent)).toBe(true);
        });

        it('keeps access from another group', async () => {
            const other = await UserGroup.create({ name: 'Friends' });
            await addMembers([alice]);
            await addMembers([alice], other);
            await shareProject(group);
            await shareProject(other);
            await accept(aliceAgent);

            await removeMember(alice, group);
            expect(await canRead(aliceAgent)).toBe(true);

            await removeMember(alice, other);
            expect(await canRead(aliceAgent)).toBe(false);
        });

        it('404s for a user who is not a member', async () => {
            const res = await removeMember(bob);
            expect(res.status).toBe(404);
        });
    });

    describe('deleting the group', () => {
        it('revokes everyone who had access through it', async () => {
            await addMembers([alice, bob]);
            await shareProject();
            await accept(aliceAgent);

            const res = await adminAgent.delete(
                `/api/admin/groups/${group.uid}`
            );
            expect(res.status).toBe(204);

            expect(await canRead(aliceAgent)).toBe(false);
            expect(await invitationsFor(bobAgent)).toHaveLength(0);
            expect(await GroupShare.count()).toBe(0);
            expect(await GroupPermission.count()).toBe(0);
            expect(await Project.findByPk(project.id)).not.toBeNull();
        });
    });

    describe('projects added to a shared area', () => {
        let area;

        beforeEach(async () => {
            area = await Area.create({ name: 'Home', user_id: owner.id });
            await addMembers([alice]);
            await ownerAgent.post('/api/shares').send({
                resource_type: 'area',
                resource_uid: area.uid,
                target_group_uid: group.uid,
                access_level: 'rw',
            });
        });

        const newProjectInArea = async () => {
            const created = await Project.create({
                name: 'Late arrival',
                user_id: owner.id,
                area_id: area.id,
            });
            const child = await Task.create({
                name: 'Child',
                user_id: owner.id,
                project_id: created.id,
            });
            await syncProjectSharesFromContainer(created.id);
            return { created, child };
        };

        it('gives members who accepted the area the new project too', async () => {
            await accept(aliceAgent);
            const { created, child } = await newProjectInArea();

            expect(
                (await aliceAgent.get(`/api/project/${created.uid}`)).status
            ).toBe(200);
            expect(
                (await aliceAgent.get(`/api/task/${child.uid}`)).status
            ).toBe(200);
        });

        it('keeps the new project hidden while the area invitation is pending', async () => {
            const { created } = await newProjectInArea();

            expect(
                (await aliceAgent.get(`/api/project/${created.uid}`)).status
            ).toBe(403);
            const rows = await GroupPermission.findAll({
                where: { user_id: alice.id, resource_uid: created.uid },
            });
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                status: 'pending',
                propagation: 'inherited',
            });

            await accept(aliceAgent);
            expect(
                (await aliceAgent.get(`/api/project/${created.uid}`)).status
            ).toBe(200);
        });

        it('is safe to run twice', async () => {
            await accept(aliceAgent);
            const { created } = await newProjectInArea();
            const before = await GroupPermission.count();

            await syncProjectSharesFromContainer(created.id);
            expect(await GroupPermission.count()).toBe(before);
        });

        it('does not create rows for the project owner', async () => {
            await UserGroupMember.create({
                group_id: group.id,
                user_id: owner.id,
            });
            const { created } = await newProjectInArea();
            expect(
                await GroupPermission.count({
                    where: { user_id: owner.id, resource_uid: created.uid },
                })
            ).toBe(0);
        });
    });
});
