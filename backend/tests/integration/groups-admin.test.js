const request = require('supertest');
const app = require('../../app');
const {
    Role,
    Project,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

describe('User groups: admin management', () => {
    let admin, adminAgent, member, memberAgent;

    beforeEach(async () => {
        admin = await createTestUser({ email: 'admin@example.com' });
        member = await createTestUser({ email: 'member@example.com' });
        await Role.destroy({ where: {} });
        await Role.create({ user_id: admin.id, is_admin: true });
        adminAgent = await loginAgent('admin@example.com');
        memberAgent = await loginAgent('member@example.com');
    });

    describe('access control', () => {
        it('rejects unauthenticated requests', async () => {
            const anon = request(app);
            expect((await anon.get('/api/groups')).status).toBe(401);
            expect((await anon.get('/api/admin/groups')).status).toBe(401);
        });

        it('returns 403 to non-admins on every admin group route', async () => {
            const group = await UserGroup.create({ name: 'Family' });
            const base = `/api/admin/groups/${group.uid}`;

            const responses = await Promise.all([
                memberAgent.get('/api/admin/groups'),
                memberAgent.post('/api/admin/groups').send({ name: 'X' }),
                memberAgent.get(base),
                memberAgent.patch(base).send({ name: 'Y' }),
                memberAgent.delete(base),
                memberAgent
                    .post(`${base}/members`)
                    .send({ user_ids: [member.id] }),
                memberAgent.delete(`${base}/members/${member.id}`),
            ]);

            responses.forEach((res) => expect(res.status).toBe(403));
            expect(await UserGroup.count()).toBe(1);
            expect((await UserGroup.findByPk(group.id)).name).toBe('Family');
        });
    });

    describe('group CRUD', () => {
        it('creates, lists, renames and deletes a group', async () => {
            const created = await adminAgent
                .post('/api/admin/groups')
                .send({ name: '  Family  ', description: 'Home crew' });
            expect(created.status).toBe(201);
            expect(created.body.group).toMatchObject({
                name: 'Family',
                description: 'Home crew',
                member_count: 0,
                share_count: 0,
            });
            const { uid } = created.body.group;

            const list = await adminAgent.get('/api/admin/groups');
            expect(list.status).toBe(200);
            expect(list.body.groups.map((g) => g.uid)).toEqual([uid]);

            const renamed = await adminAgent
                .patch(`/api/admin/groups/${uid}`)
                .send({ name: 'Household' });
            expect(renamed.status).toBe(200);
            expect(renamed.body.group.name).toBe('Household');
            expect(renamed.body.group.description).toBe('Home crew');

            const deleted = await adminAgent.delete(`/api/admin/groups/${uid}`);
            expect(deleted.status).toBe(204);
            expect(await UserGroup.count()).toBe(0);
        });

        it('records the creating admin', async () => {
            const res = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' });
            const group = await UserGroup.findOne({
                where: { uid: res.body.group.uid },
            });
            expect(group.created_by_user_id).toBe(admin.id);
        });

        it('validates the name', async () => {
            const blank = await adminAgent
                .post('/api/admin/groups')
                .send({ name: '   ' });
            expect(blank.status).toBe(400);

            const tooLong = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'a'.repeat(101) });
            expect(tooLong.status).toBe(400);
        });

        it('rejects a duplicate name regardless of case', async () => {
            await adminAgent.post('/api/admin/groups').send({ name: 'Family' });
            const dup = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'family' });
            expect(dup.status).toBe(409);
            expect(await UserGroup.count()).toBe(1);
        });

        it('rejects renaming onto another group but allows keeping its own name', async () => {
            await adminAgent.post('/api/admin/groups').send({ name: 'Family' });
            const other = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Work' });
            const uid = other.body.group.uid;

            const clash = await adminAgent
                .patch(`/api/admin/groups/${uid}`)
                .send({ name: 'FAMILY' });
            expect(clash.status).toBe(409);

            const same = await adminAgent
                .patch(`/api/admin/groups/${uid}`)
                .send({ name: 'Work', description: 'Office' });
            expect(same.status).toBe(200);
        });

        it('rejects an empty update', async () => {
            const res = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' });
            const patch = await adminAgent
                .patch(`/api/admin/groups/${res.body.group.uid}`)
                .send({});
            expect(patch.status).toBe(400);
        });

        it('returns 404 for an unknown group', async () => {
            expect(
                (await adminAgent.get('/api/admin/groups/nope')).status
            ).toBe(404);
            expect(
                (await adminAgent.delete('/api/admin/groups/nope')).status
            ).toBe(404);
        });
    });

    describe('membership', () => {
        let group, other;

        beforeEach(async () => {
            group = await UserGroup.create({ name: 'Family' });
            other = await createTestUser({ email: 'other@example.com' });
        });

        it('adds members and reports ones already in the group', async () => {
            const first = await adminAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [member.id, other.id] });
            expect(first.status).toBe(200);
            expect(first.body.added.sort()).toEqual(
                [member.id, other.id].sort()
            );
            expect(first.body.already_members).toEqual([]);

            const again = await adminAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [member.id, member.id] });
            expect(again.body.added).toEqual([]);
            expect(again.body.already_members).toEqual([member.id]);
            expect(
                await UserGroupMember.count({ where: { group_id: group.id } })
            ).toBe(2);
        });

        it('rejects unknown users and malformed ids without adding anyone', async () => {
            const unknown = await adminAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [member.id, 999999] });
            expect(unknown.status).toBe(400);

            const malformed = await adminAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: ['1'] });
            expect(malformed.status).toBe(400);

            const empty = await adminAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [] });
            expect(empty.status).toBe(400);

            expect(await UserGroupMember.count()).toBe(0);
        });

        it('lists members with counts in the detail response', async () => {
            await adminAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [member.id] });

            const detail = await adminAgent.get(
                `/api/admin/groups/${group.uid}`
            );
            expect(detail.status).toBe(200);
            expect(detail.body.group.member_count).toBe(1);
            expect(detail.body.members).toEqual([
                expect.objectContaining({
                    user_id: member.id,
                    email: 'member@example.com',
                }),
            ]);
            expect(detail.body.shares).toEqual([]);
        });

        it('removes a member and 404s when the user is not one', async () => {
            await adminAgent
                .post(`/api/admin/groups/${group.uid}/members`)
                .send({ user_ids: [member.id] });

            const removed = await adminAgent.delete(
                `/api/admin/groups/${group.uid}/members/${member.id}`
            );
            expect(removed.status).toBe(204);

            const again = await adminAgent.delete(
                `/api/admin/groups/${group.uid}/members/${member.id}`
            );
            expect(again.status).toBe(404);

            const bad = await adminAgent.delete(
                `/api/admin/groups/${group.uid}/members/abc`
            );
            expect(bad.status).toBe(400);
        });
    });

    describe('group picker', () => {
        it('lets any user list groups without exposing members', async () => {
            const group = await UserGroup.create({
                name: 'Family',
                description: 'private note',
            });
            await UserGroupMember.create({
                group_id: group.id,
                user_id: admin.id,
            });

            const res = await memberAgent.get('/api/groups');
            expect(res.status).toBe(200);
            expect(res.body.groups).toEqual([
                { uid: group.uid, name: 'Family', member_count: 1 },
            ]);
            expect(JSON.stringify(res.body)).not.toContain('admin@example.com');
        });

        it('sorts groups by name case-insensitively', async () => {
            await UserGroup.create({ name: 'work' });
            await UserGroup.create({ name: 'Family' });
            await UserGroup.create({ name: 'Alpha' });

            const res = await memberAgent.get('/api/groups');
            expect(res.body.groups.map((g) => g.name)).toEqual([
                'Alpha',
                'Family',
                'work',
            ]);
        });
    });

    describe('deleting a group', () => {
        it('removes its members, grants and the access rows they produced', async () => {
            const group = await UserGroup.create({ name: 'Family' });
            await UserGroupMember.create({
                group_id: group.id,
                user_id: member.id,
            });
            const project = await Project.create({
                name: 'Shared',
                user_id: admin.id,
            });
            const grant = await GroupShare.create({
                group_id: group.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                granted_by_user_id: admin.id,
            });
            await GroupPermission.create({
                group_share_id: grant.id,
                user_id: member.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                granted_by_user_id: admin.id,
            });

            const detail = await adminAgent.get(
                `/api/admin/groups/${group.uid}`
            );
            expect(detail.body.shares).toEqual([
                {
                    resource_type: 'project',
                    resource_uid: project.uid,
                    resource_name: 'Shared',
                    access_level: 'rw',
                },
            ]);

            const res = await adminAgent.delete(
                `/api/admin/groups/${group.uid}`
            );
            expect(res.status).toBe(204);

            expect(await UserGroup.count()).toBe(0);
            expect(await UserGroupMember.count()).toBe(0);
            expect(await GroupShare.count()).toBe(0);
            expect(await GroupPermission.count()).toBe(0);
            expect(await Project.findByPk(project.id)).not.toBeNull();
        });
    });
});
