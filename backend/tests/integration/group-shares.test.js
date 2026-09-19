const request = require('supertest');
const app = require('../../app');
const {
    Role,
    Project,
    Task,
    Note,
    Area,
    Notification,
    Permission,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function login(user) {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
}

function parseData(notification) {
    return typeof notification.data === 'string'
        ? JSON.parse(notification.data)
        : notification.data;
}

async function makeGroup(name, users) {
    const group = await UserGroup.create({ name });
    for (const user of users) {
        await UserGroupMember.create({ group_id: group.id, user_id: user.id });
    }
    return group;
}

describe('Sharing a resource with a group', () => {
    let owner, alice, bob, outsider;
    let ownerAgent, aliceAgent, bobAgent, outsiderAgent;
    let group, project, task, note;

    const shareToGroup = (agent, body = {}) =>
        agent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_group_uid: group.uid,
            access_level: 'rw',
            ...body,
        });

    const invitationsFor = async (agent) =>
        (await agent.get('/api/shares/invitations')).body.invitations;

    beforeEach(async () => {
        const stamp = Date.now();
        const users = [];
        // Sequential: the first user created becomes admin, and creating
        // them in parallel races that hook. Nobody here is an admin unless a
        // test grants it.
        for (const name of ['owner', 'alice', 'bob', 'outsider']) {
            users.push(
                await createTestUser({
                    email: `${name}_${stamp}@test.com`,
                    name,
                })
            );
        }
        [owner, alice, bob, outsider] = users;
        await Role.destroy({ where: {} });
        [ownerAgent, aliceAgent, bobAgent, outsiderAgent] = await Promise.all(
            [owner, alice, bob, outsider].map(login)
        );

        group = await makeGroup('Family', [alice, bob]);
        project = await Project.create({ name: 'Shared', user_id: owner.id });
        task = await Task.create({
            name: 'Task',
            user_id: owner.id,
            project_id: project.id,
        });
        note = await Note.create({
            title: 'Note',
            content: 'c',
            user_id: owner.id,
            project_id: project.id,
        });
    });

    describe('granting', () => {
        it('creates pending rows for each member and notifies them', async () => {
            const res = await shareToGroup(ownerAgent);
            expect(res.status).toBe(204);

            const rows = await GroupPermission.findAll({
                where: { resource_uid: project.uid },
            });
            expect(rows.map((r) => r.user_id).sort()).toEqual(
                [alice.id, bob.id].sort()
            );
            rows.forEach((r) => {
                expect(r.status).toBe('pending');
                expect(r.access_level).toBe('rw');
                expect(r.granted_by_user_id).toBe(owner.id);
            });

            const notifications = await Notification.findAll({
                where: { user_id: alice.id, type: 'share_invitation' },
            });
            expect(notifications).toHaveLength(1);
            expect(parseData(notifications[0])).toMatchObject({
                resourceUid: project.uid,
                groupName: 'Family',
                groupUid: group.uid,
            });
            expect(String(parseData(notifications[0]).invitationId)).toMatch(
                /^g\d+$/
            );
        });

        it('cascades to the tasks and notes inside a project', async () => {
            await shareToGroup(ownerAgent);

            const alicesRows = await GroupPermission.findAll({
                where: { user_id: alice.id },
            });
            expect(
                alicesRows.map((r) => `${r.resource_type}:${r.propagation}`)
            ).toEqual(
                expect.arrayContaining([
                    'project:direct',
                    'task:inherited',
                    'note:inherited',
                ])
            );
        });

        it('does not touch the permissions table', async () => {
            await shareToGroup(ownerAgent);
            expect(await Permission.count()).toBe(0);
        });

        it('never makes the resource owner a recipient', async () => {
            await UserGroupMember.create({
                group_id: group.id,
                user_id: owner.id,
            });
            await shareToGroup(ownerAgent);

            expect(
                await GroupPermission.count({ where: { user_id: owner.id } })
            ).toBe(0);
        });

        it('gives no access until a member accepts', async () => {
            await shareToGroup(ownerAgent);

            const before = await aliceAgent.get(`/api/project/${project.uid}`);
            expect(before.status).toBe(403);
            expect(
                (await aliceAgent.get('/api/projects')).body.projects
            ).toHaveLength(0);
        });
    });

    describe('invitations', () => {
        it('lists a group invitation with its group and a prefixed id', async () => {
            await shareToGroup(ownerAgent);

            const invitations = await invitationsFor(aliceAgent);
            expect(invitations).toHaveLength(1);
            expect(invitations[0]).toMatchObject({
                resource_type: 'project',
                resource_uid: project.uid,
                resource_name: 'Shared',
                access_level: 'rw',
                inviter_email: owner.email,
                via_group: { uid: group.uid, name: 'Family' },
            });
            expect(invitations[0].id).toMatch(/^g\d+$/);
        });

        it('grants access to the whole set when a member accepts', async () => {
            await shareToGroup(ownerAgent);
            const [invitation] = await invitationsFor(aliceAgent);

            const accepted = await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );
            expect(accepted.status).toBe(200);
            expect(accepted.body).toEqual({
                resource_type: 'project',
                resource_uid: project.uid,
            });

            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(200);
            expect((await aliceAgent.get(`/api/task/${task.uid}`)).status).toBe(
                200
            );
            expect(await invitationsFor(aliceAgent)).toHaveLength(0);

            // Bob has not answered, so he still has nothing.
            expect(
                (await bobAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(403);
            expect(await invitationsFor(bobAgent)).toHaveLength(1);
        });

        it('removes the member rows when they decline', async () => {
            await shareToGroup(ownerAgent);
            const [invitation] = await invitationsFor(aliceAgent);

            const declined = await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/decline`
            );
            expect(declined.status).toBe(204);

            expect(
                await GroupPermission.count({ where: { user_id: alice.id } })
            ).toBe(0);
            expect(
                await GroupPermission.count({ where: { user_id: bob.id } })
            ).toBeGreaterThan(0);
            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(403);
        });

        it("does not let a member answer someone else's invitation", async () => {
            await shareToGroup(ownerAgent);
            const [invitation] = await invitationsFor(aliceAgent);

            const res = await outsiderAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );
            expect(res.status).toBe(404);
            const bobs = await bobAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );
            expect(bobs.status).toBe(404);
        });

        it('still answers direct invitations by numeric id', async () => {
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: outsider.email,
                access_level: 'ro',
            });
            const [invitation] = await invitationsFor(outsiderAgent);
            expect(typeof invitation.id).toBe('number');

            const res = await outsiderAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );
            expect(res.status).toBe(200);
        });

        it('404s on a malformed invitation id', async () => {
            const res = await aliceAgent.post(
                '/api/shares/invitations/gabc/accept'
            );
            expect(res.status).toBe(404);
        });
    });

    describe('overlapping grants', () => {
        it('accepts silently when the member already holds that access directly', async () => {
            await Permission.create({
                user_id: alice.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
                status: 'accepted',
            });

            await shareToGroup(ownerAgent, { access_level: 'ro' });

            const row = await GroupPermission.findOne({
                where: { user_id: alice.id, resource_type: 'project' },
            });
            expect(row.status).toBe('accepted');
            expect(await invitationsFor(aliceAgent)).toHaveLength(0);
            expect(
                await Notification.count({
                    where: { user_id: alice.id, type: 'share_invitation' },
                })
            ).toBe(0);
            // Bob had nothing, so he is still invited.
            expect(await invitationsFor(bobAgent)).toHaveLength(1);
        });

        it('asks again when the group would raise the level', async () => {
            await Permission.create({
                user_id: alice.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
                status: 'accepted',
            });

            await shareToGroup(ownerAgent, { access_level: 'rw' });

            const row = await GroupPermission.findOne({
                where: { user_id: alice.id, resource_type: 'project' },
            });
            expect(row.status).toBe('pending');
            expect(await invitationsFor(aliceAgent)).toHaveLength(1);
        });

        it('keeps a direct share when the group grant is revoked', async () => {
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: alice.email,
                access_level: 'ro',
            });
            const direct = (await invitationsFor(aliceAgent)).find(
                (i) => typeof i.id === 'number'
            );
            await aliceAgent.post(
                `/api/shares/invitations/${direct.id}/accept`
            );

            await shareToGroup(ownerAgent, { access_level: 'ro' });
            await ownerAgent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: group.uid,
            });

            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(200);
        });

        it('keeps a group grant when the direct share is revoked', async () => {
            await shareToGroup(ownerAgent);
            const [invitation] = await invitationsFor(aliceAgent);
            await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );
            await Permission.create({
                user_id: alice.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
                status: 'accepted',
            });

            await ownerAgent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_id: alice.id,
            });

            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(200);
        });

        it('treats two groups as independent grants', async () => {
            const second = await makeGroup('Friends', [alice]);
            await shareToGroup(ownerAgent, { access_level: 'ro' });
            await shareToGroup(ownerAgent, {
                target_group_uid: second.uid,
                access_level: 'rw',
            });

            const invitations = await invitationsFor(aliceAgent);
            expect(invitations).toHaveLength(2);
            expect(invitations.map((i) => i.via_group.name).sort()).toEqual([
                'Family',
                'Friends',
            ]);

            const friends = invitations.find(
                (i) => i.via_group.name === 'Friends'
            );
            await aliceAgent.post(
                `/api/shares/invitations/${friends.id}/accept`
            );

            await ownerAgent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: second.uid,
            });
            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(403);
            // Alice's still-pending invitation from the first group is intact.
            expect(await invitationsFor(aliceAgent)).toHaveLength(1);
        });

        it('only raises the level when the same group is shared again', async () => {
            await shareToGroup(ownerAgent, { access_level: 'ro' });
            const [invitation] = await invitationsFor(aliceAgent);
            await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );
            const notificationsBefore = await Notification.count({
                where: { type: 'share_invitation' },
            });

            await shareToGroup(ownerAgent, { access_level: 'rw' });
            await shareToGroup(ownerAgent, { access_level: 'ro' });

            expect(await GroupShare.count()).toBe(1);
            expect((await GroupShare.findOne()).access_level).toBe('rw');
            const alicesProject = await GroupPermission.findOne({
                where: { user_id: alice.id, resource_type: 'project' },
            });
            expect(alicesProject.access_level).toBe('rw');
            expect(alicesProject.status).toBe('accepted');
            expect(
                await Notification.count({
                    where: { type: 'share_invitation' },
                })
            ).toBe(notificationsBefore);
        });
    });

    describe('revoking', () => {
        it('removes the grant and every member row it produced', async () => {
            await shareToGroup(ownerAgent);
            const [invitation] = await invitationsFor(aliceAgent);
            await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );

            const res = await ownerAgent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: group.uid,
            });
            expect(res.status).toBe(204);

            expect(await GroupShare.count()).toBe(0);
            expect(await GroupPermission.count()).toBe(0);
            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(403);
            expect(await Project.findByPk(project.id)).not.toBeNull();
        });

        it('404s when the resource is not shared with the group', async () => {
            const res = await ownerAgent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: group.uid,
            });
            expect(res.status).toBe(404);
        });

        it('404s for an unknown group', async () => {
            const res = await ownerAgent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: 'nope',
            });
            expect(res.status).toBe(404);
        });
    });

    describe('other resource types', () => {
        it('shares an area with its projects and their contents', async () => {
            const area = await Area.create({ name: 'Home', user_id: owner.id });
            await project.update({ area_id: area.id });

            const res = await shareToGroup(ownerAgent, {
                resource_type: 'area',
                resource_uid: area.uid,
            });
            expect(res.status).toBe(204);

            const alicesRows = await GroupPermission.findAll({
                where: { user_id: alice.id },
            });
            expect(
                alicesRows.map((r) => `${r.resource_type}:${r.propagation}`)
            ).toEqual(
                expect.arrayContaining([
                    'area:direct',
                    'project:inherited',
                    'task:inherited',
                    'note:inherited',
                ])
            );

            const [invitation] = await invitationsFor(aliceAgent);
            expect(invitation.resource_type).toBe('area');
            await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );
            expect(
                (await aliceAgent.get(`/api/project/${project.uid}`)).status
            ).toBe(200);
        });

        it('shares a single note', async () => {
            const res = await shareToGroup(ownerAgent, {
                resource_type: 'note',
                resource_uid: note.uid,
                access_level: 'ro',
            });
            expect(res.status).toBe(204);
            expect(
                await GroupPermission.count({
                    where: { resource_type: 'note', resource_uid: note.uid },
                })
            ).toBe(2);
        });
    });

    describe('validation and permissions', () => {
        it('rejects a non-owner', async () => {
            const res = await outsiderAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: group.uid,
                access_level: 'rw',
            });
            expect(res.status).toBe(403);
            expect(await GroupShare.count()).toBe(0);
        });

        it('lets an admin share a resource they do not own', async () => {
            await Role.create({ user_id: outsider.id, is_admin: true });
            const res = await outsiderAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_group_uid: group.uid,
                access_level: 'rw',
            });
            expect(res.status).toBe(204);
            expect(await GroupShare.count()).toBe(1);
        });

        it('rejects giving both a user and a group, or neither', async () => {
            const both = await shareToGroup(ownerAgent, {
                target_user_email: alice.email,
            });
            expect(both.status).toBe(400);

            const neither = await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
            });
            expect(neither.status).toBe(400);
        });

        it('404s for an unknown group', async () => {
            const res = await shareToGroup(ownerAgent, {
                target_group_uid: 'nope',
            });
            expect(res.status).toBe(404);
            expect(await GroupShare.count()).toBe(0);
        });

        it('rejects an invalid access level', async () => {
            const res = await shareToGroup(ownerAgent, {
                access_level: 'admin',
            });
            expect(res.status).toBe(400);
        });

        it('shares with an empty group without error', async () => {
            const empty = await makeGroup('Empty', []);
            const res = await shareToGroup(ownerAgent, {
                target_group_uid: empty.uid,
            });
            expect(res.status).toBe(204);
            expect(
                await GroupShare.count({ where: { group_id: empty.id } })
            ).toBe(1);
            expect(await GroupPermission.count()).toBe(0);
        });
    });

    describe('listing shares', () => {
        it('reports groups with counts and no member identities', async () => {
            await shareToGroup(ownerAgent);
            const [invitation] = await invitationsFor(aliceAgent);
            await aliceAgent.post(
                `/api/shares/invitations/${invitation.id}/accept`
            );

            const res = await ownerAgent.get(
                `/api/shares?resource_type=project&resource_uid=${project.uid}`
            );
            expect(res.status).toBe(200);
            expect(res.body.group_shares).toEqual([
                expect.objectContaining({
                    group_uid: group.uid,
                    group_name: 'Family',
                    access_level: 'rw',
                    member_count: 2,
                    accepted_count: 1,
                    pending_count: 1,
                }),
            ]);
            expect(res.body.shares.map((s) => s.email)).toEqual([owner.email]);
            const serialized = JSON.stringify(res.body.group_shares);
            expect(serialized).not.toContain(alice.email);
            expect(serialized).not.toContain(bob.email);
        });

        it('returns an empty group list for an unshared resource', async () => {
            const res = await ownerAgent.get(
                `/api/shares?resource_type=project&resource_uid=${project.uid}`
            );
            expect(res.body.group_shares).toEqual([]);
        });
    });
});
