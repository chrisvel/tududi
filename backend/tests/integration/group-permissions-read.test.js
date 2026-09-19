const request = require('supertest');
const app = require('../../app');
const {
    Project,
    Task,
    Note,
    Permission,
    UserGroup,
    GroupShare,
    GroupPermission,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const permissionsService = require('../../services/permissionsService');
const permissionSources = require('../../services/permissionSources');
const peopleService = require('../../modules/people/service');

async function login(user) {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
}

let groupSequence = 0;

// Seeds what a group grant would materialize for one member, so the read path
// can be checked without the write path.
async function seedGroupGrant({
    owner,
    member,
    project,
    level = 'rw',
    status = 'accepted',
    group = null,
}) {
    const grantGroup =
        group ||
        (await UserGroup.create({ name: `Group ${(groupSequence += 1)}` }));
    const grant =
        (await GroupShare.findOne({
            where: {
                group_id: grantGroup.id,
                resource_type: 'project',
                resource_uid: project.uid,
            },
        })) ||
        (await GroupShare.create({
            group_id: grantGroup.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: level,
            granted_by_user_id: owner.id,
        }));
    await GroupPermission.create({
        group_share_id: grant.id,
        user_id: member.id,
        resource_type: 'project',
        resource_uid: project.uid,
        access_level: level,
        granted_by_user_id: owner.id,
        status,
    });
    return grantGroup;
}

async function seedDirectGrant({ owner, member, project, level }) {
    return Permission.create({
        user_id: member.id,
        resource_type: 'project',
        resource_uid: project.uid,
        access_level: level,
        propagation: 'direct',
        granted_by_user_id: owner.id,
        status: 'accepted',
    });
}

describe('Group-derived access on the read path', () => {
    let owner, member, other, project;

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({
            email: `owner_${stamp}@test.com`,
            name: 'Owner',
        });
        member = await createTestUser({
            email: `member_${stamp}@test.com`,
            name: 'Member',
        });
        other = await createTestUser({
            email: `other_${stamp}@test.com`,
            name: 'Other',
        });
        project = await Project.create({ name: 'Shared', user_id: owner.id });
    });

    describe('getAccess', () => {
        it('grants the level of an accepted group row', async () => {
            await seedGroupGrant({ owner, member, project, level: 'ro' });
            expect(
                await permissionsService.getAccess(
                    member.id,
                    'project',
                    project.uid
                )
            ).toBe('ro');
        });

        it('grants nothing for a pending group row', async () => {
            await seedGroupGrant({
                owner,
                member,
                project,
                status: 'pending',
            });
            expect(
                await permissionsService.getAccess(
                    member.id,
                    'project',
                    project.uid
                )
            ).toBe('none');
        });

        it('grants nothing to a user with no row', async () => {
            await seedGroupGrant({ owner, member, project });
            expect(
                await permissionsService.getAccess(
                    other.id,
                    'project',
                    project.uid
                )
            ).toBe('none');
        });

        it('inherits to tasks and notes in the project', async () => {
            await seedGroupGrant({ owner, member, project, level: 'ro' });
            const task = await Task.create({
                name: 'T',
                user_id: owner.id,
                project_id: project.id,
            });
            const note = await Note.create({
                title: 'N',
                content: 'c',
                user_id: owner.id,
                project_id: project.id,
            });

            expect(
                await permissionsService.getAccess(member.id, 'task', task.uid)
            ).toBe('ro');
            expect(
                await permissionsService.getAccess(member.id, 'note', note.uid)
            ).toBe('ro');
        });
    });

    describe('overlapping sources', () => {
        const levelFor = (userId) =>
            permissionsService.getAccess(userId, 'project', project.uid);

        it('takes the higher level when a group upgrades a direct share', async () => {
            await seedDirectGrant({ owner, member, project, level: 'ro' });
            await seedGroupGrant({ owner, member, project, level: 'rw' });
            expect(await levelFor(member.id)).toBe('rw');
        });

        it('keeps the direct level when the group grants less', async () => {
            await seedDirectGrant({ owner, member, project, level: 'rw' });
            await seedGroupGrant({ owner, member, project, level: 'ro' });
            expect(await levelFor(member.id)).toBe('rw');
        });

        it('takes the highest level across two groups', async () => {
            await seedGroupGrant({ owner, member, project, level: 'ro' });
            await seedGroupGrant({ owner, member, project, level: 'rw' });
            expect(await levelFor(member.id)).toBe('rw');
        });

        it('ignores a pending group row when a direct share is accepted', async () => {
            await seedDirectGrant({ owner, member, project, level: 'ro' });
            await seedGroupGrant({
                owner,
                member,
                project,
                level: 'rw',
                status: 'pending',
            });
            expect(await levelFor(member.id)).toBe('ro');
        });

        it('lists a shared resource once even when both sources grant it', async () => {
            await seedDirectGrant({ owner, member, project, level: 'ro' });
            await seedGroupGrant({ owner, member, project, level: 'rw' });
            const uids = await permissionsService.getSharedUidsForUser(
                'project',
                member.id
            );
            expect(uids).toEqual([project.uid]);
        });
    });

    describe('listings', () => {
        it('shows a group-shared project and its tasks to the member', async () => {
            await seedGroupGrant({ owner, member, project });
            const task = await Task.create({
                name: 'Group task',
                user_id: owner.id,
                project_id: project.id,
            });
            const agent = await login(member);

            const projects = await agent.get('/api/projects');
            expect(projects.body.projects.map((p) => p.uid)).toContain(
                project.uid
            );

            const detail = await agent.get(`/api/project/${project.uid}`);
            expect(detail.status).toBe(200);

            const taskDetail = await agent.get(`/api/task/${task.uid}`);
            expect(taskDetail.status).toBe(200);
        });

        it('hides the project from users outside the group', async () => {
            await seedGroupGrant({ owner, member, project });
            const agent = await login(other);

            const projects = await agent.get('/api/projects');
            expect(projects.body.projects.map((p) => p.uid)).not.toContain(
                project.uid
            );
            const detail = await agent.get(`/api/project/${project.uid}`);
            expect(detail.status).toBe(403);
        });
    });

    describe('share counts', () => {
        it('counts distinct users across both sources', async () => {
            await seedDirectGrant({ owner, member, project, level: 'ro' });
            const group = await seedGroupGrant({
                owner,
                member,
                project,
                level: 'rw',
            });
            await seedGroupGrant({
                owner,
                member: other,
                project,
                group,
            });
            const agent = await login(owner);

            const res = await agent.get('/api/projects');
            const listed = res.body.projects.find((p) => p.uid === project.uid);
            expect(listed.share_count).toBe(2);
            expect(listed.is_shared).toBe(true);
        });

        it('does not count pending group rows', async () => {
            await seedGroupGrant({
                owner,
                member,
                project,
                status: 'pending',
            });
            const agent = await login(owner);

            const res = await agent.get('/api/projects');
            const listed = res.body.projects.find((p) => p.uid === project.uid);
            expect(listed.share_count).toBe(0);
            expect(listed.is_shared).toBe(false);
        });

        it('counts distinct users per resource in the facade', async () => {
            await seedDirectGrant({ owner, member, project, level: 'ro' });
            await seedGroupGrant({ owner, member, project });

            expect(
                await permissionSources.countDistinctUsersByResource(
                    'project',
                    [project.uid, 'missing']
                )
            ).toEqual({ [project.uid]: 1 });
            expect(
                await permissionSources.countDistinctUsersByResource(
                    'project',
                    []
                )
            ).toEqual({});
        });
    });

    describe('collaborators', () => {
        it('flips has_collaborators for the member and the granter', async () => {
            const memberAgent = await login(member);
            const ownerAgent = await login(owner);
            expect(
                (await memberAgent.get('/api/current_user')).body.user
                    .has_collaborators
            ).toBe(false);

            await seedGroupGrant({ owner, member, project });

            expect(
                (await memberAgent.get('/api/current_user')).body.user
                    .has_collaborators
            ).toBe(true);
            expect(
                (await ownerAgent.get('/api/current_user')).body.user
                    .has_collaborators
            ).toBe(true);
        });

        it('leaves has_collaborators false while the group row is pending', async () => {
            await seedGroupGrant({
                owner,
                member,
                project,
                status: 'pending',
            });
            const agent = await login(member);
            expect(
                (await agent.get('/api/current_user')).body.user
                    .has_collaborators
            ).toBe(false);
        });

        it('offers group members as assignable people', async () => {
            await peopleService.createSelfPerson(owner);
            await peopleService.createSelfPerson(member);
            await seedGroupGrant({ owner, member, project });

            const ownerAgent = await login(owner);
            const memberAgent = await login(member);

            const forOwner = await ownerAgent.get(
                `/api/projects/${project.uid}/assignable-people`
            );
            expect(forOwner.body.people.map((p) => p.name)).toContain('Member');

            const forMember = await memberAgent.get(
                `/api/projects/${project.uid}/assignable-people`
            );
            expect(forMember.status).toBe(200);
            expect(forMember.body.people.map((p) => p.name)).toContain('Owner');
        });

        it('shows the group member as a column on the owner Everyone board', async () => {
            await peopleService.createSelfPerson(owner);
            await peopleService.createSelfPerson(member);
            await seedGroupGrant({ owner, member, project });
            const agent = await login(owner);

            const res = await agent.get('/api/everyone');
            expect(res.status).toBe(200);
            expect(
                res.body.columns.map((c) => c.person.linked_user_id)
            ).toContain(member.id);
        });
    });
});
