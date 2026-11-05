const request = require('supertest');
const app = require('../../app');
const {
    Area,
    Project,
    Task,
    Permission,
    GroupPermission,
    UserGroup,
    UserGroupMember,
} = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const projectUids = (res) => (res.body.projects || res.body).map((p) => p.uid);

describe('Shared areas: access follows the area', () => {
    let owner, member, ownerAgent, memberAgent, area, otherArea;

    const shareArea = async (target, accessLevel = 'rw') => {
        const res = await ownerAgent.post('/api/shares').send({
            resource_type: 'area',
            resource_uid: target.uid,
            target_user_email: member.email,
            access_level: accessLevel,
        });
        expect([200, 201, 204]).toContain(res.status);
        await acceptAllInvitations(memberAgent);
    };

    const createProject = async (data) => {
        const res = await ownerAgent.post('/api/project').send(data);
        expect(res.status).toBe(201);
        return res.body;
    };

    const memberCanOpen = async (project) =>
        (await memberAgent.get(`/api/project/${project.uid}`)).status === 200;

    beforeEach(async () => {
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        owner = await createTestUser({ email: `owner_${stamp}@example.com` });
        member = await createTestUser({
            email: `member_${stamp}@example.com`,
        });
        ownerAgent = await login(owner);
        memberAgent = await login(member);

        area = await Area.create({ name: 'Clients', user_id: owner.id });
        otherArea = await Area.create({ name: 'Private', user_id: owner.id });
    });

    it('shows a project created in a shared area after it was shared', async () => {
        await shareArea(area);
        const project = await createProject({
            name: 'Acme website',
            area_id: area.id,
        });

        expect(await memberCanOpen(project)).toBe(true);
        expect(projectUids(await memberAgent.get('/api/projects'))).toContain(
            project.uid
        );
    });

    it('takes access back when a project moves out of the shared area', async () => {
        await shareArea(area);
        const project = await createProject({
            name: 'Acme website',
            area_id: area.id,
        });
        const task = await Task.create({
            name: 'Draft homepage',
            user_id: owner.id,
            project_id: project.id,
        });
        expect(await memberCanOpen(project)).toBe(true);

        const move = await ownerAgent
            .patch(`/api/project/${project.uid}`)
            .send({ area_id: otherArea.id });
        expect(move.status).toBe(200);

        expect(await memberCanOpen(project)).toBe(false);
        expect((await memberAgent.get(`/api/task/${task.uid}`)).status).toBe(
            403
        );
        expect(
            await Permission.count({
                where: { user_id: member.id, resource_uid: project.uid },
            })
        ).toBe(0);
    });

    it('keeps a direct project share when the project moves out of the area', async () => {
        await shareArea(area);
        const project = await createProject({
            name: 'Acme website',
            area_id: area.id,
        });
        const direct = await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: member.email,
            access_level: 'rw',
        });
        expect([200, 201, 204]).toContain(direct.status);
        await acceptAllInvitations(memberAgent);

        await ownerAgent
            .patch(`/api/project/${project.uid}`)
            .send({ area_id: otherArea.id });

        expect(await memberCanOpen(project)).toBe(true);
    });

    it('keeps a restricted project from area members and the area cascade', async () => {
        const project = await createProject({
            name: 'Salary review',
            area_id: area.id,
            visibility: 'restricted',
        });
        await shareArea(area);

        expect(await memberCanOpen(project)).toBe(false);
        expect(
            projectUids(await memberAgent.get('/api/projects'))
        ).not.toContain(project.uid);
    });

    it('takes area access back when a project is restricted, and gives it back when opened up', async () => {
        await shareArea(area);
        const project = await createProject({
            name: 'Salary review',
            area_id: area.id,
        });
        expect(await memberCanOpen(project)).toBe(true);

        const restrict = await ownerAgent
            .patch(`/api/project/${project.uid}`)
            .send({ visibility: 'restricted' });
        expect(restrict.status).toBe(200);
        expect(restrict.body.visibility).toBe('restricted');
        expect(await memberCanOpen(project)).toBe(false);

        await ownerAgent
            .patch(`/api/project/${project.uid}`)
            .send({ visibility: 'area' });
        expect(await memberCanOpen(project)).toBe(true);
    });

    it('rejects an unknown visibility', async () => {
        const project = await createProject({ name: 'Acme', area_id: area.id });
        const res = await ownerAgent
            .patch(`/api/project/${project.uid}`)
            .send({ visibility: 'secret' });
        expect(res.status).toBe(400);
    });

    it('does not let an area member restrict a project they do not own', async () => {
        await shareArea(area);
        const project = await createProject({ name: 'Acme', area_id: area.id });

        const res = await memberAgent
            .patch(`/api/project/${project.uid}`)
            .send({ visibility: 'restricted' });
        expect(res.status).toBe(403);
        expect((await Project.findByPk(project.id)).visibility).toBe('area');
    });

    it('lets the area owner see and restrict a project someone else keeps in their area', async () => {
        const memberProject = await Project.create({
            name: 'Member project',
            user_id: member.id,
            area_id: area.id,
        });

        const open = await ownerAgent.get(`/api/project/${memberProject.uid}`);
        expect(open.status).toBe(200);
        expect(projectUids(await ownerAgent.get('/api/projects'))).toContain(
            memberProject.uid
        );

        const restrict = await ownerAgent
            .patch(`/api/project/${memberProject.uid}`)
            .send({ visibility: 'restricted' });
        expect(restrict.status).toBe(200);

        // Restricted projects stay visible to the area owner
        expect(
            (await ownerAgent.get(`/api/project/${memberProject.uid}`)).status
        ).toBe(200);
    });

    describe('tasks filed straight into an area', () => {
        let looseTask;

        beforeEach(async () => {
            looseTask = await Task.create({
                name: 'Call the accountant',
                user_id: owner.id,
                area_id: area.id,
            });
        });

        it('are shared with the area', async () => {
            await shareArea(area, 'ro');

            const one = await memberAgent.get(`/api/task/${looseTask.uid}`);
            expect(one.status).toBe(200);

            const list = await memberAgent.get('/api/tasks?type=all');
            expect(list.body.tasks.map((t) => t.uid)).toContain(looseTask.uid);

            const edit = await memberAgent
                .patch(`/api/task/${looseTask.uid}`)
                .send({ name: 'Renamed' });
            expect(edit.status).toBe(403);
        });

        it('stay hidden until the invitation is accepted', async () => {
            await ownerAgent.post('/api/shares').send({
                resource_type: 'area',
                resource_uid: area.uid,
                target_user_email: member.email,
                access_level: 'rw',
            });

            expect(
                (await memberAgent.get(`/api/task/${looseTask.uid}`)).status
            ).toBe(403);
        });

        it('stay private in an area that is not shared', async () => {
            const privateTask = await Task.create({
                name: 'Private errand',
                user_id: owner.id,
                area_id: otherArea.id,
            });
            await shareArea(area);

            expect(
                (await memberAgent.get(`/api/task/${privateTask.uid}`)).status
            ).toBe(403);
        });
    });

    describe('personal views show my work only', () => {
        const today = () => new Date().toISOString().split('T')[0];

        it("keeps other people's tasks in a shared area out of Today and metrics", async () => {
            await shareArea(area);
            const project = await createProject({
                name: 'Acme website',
                area_id: area.id,
            });
            const theirs = await Task.create({
                name: 'Owner task',
                user_id: owner.id,
                project_id: project.id,
                due_date: today(),
                status: Task.STATUS.IN_PROGRESS,
            });
            const mine = await Task.create({
                name: 'Member task',
                user_id: member.id,
                project_id: project.id,
                due_date: today(),
                status: Task.STATUS.IN_PROGRESS,
            });

            const todayRes = await memberAgent.get(
                '/api/tasks?type=today&include_lists=true'
            );
            const todayUids = [
                ...todayRes.body.tasks,
                ...(todayRes.body.tasks_due_today || []),
                ...(todayRes.body.tasks_in_progress || []),
            ].map((t) => t.uid);
            expect(todayUids).toContain(mine.uid);
            expect(todayUids).not.toContain(theirs.uid);

            const metrics = await memberAgent.get('/api/tasks/metrics');
            const inProgress = metrics.body.tasks_in_progress.map((t) => t.uid);
            expect(inProgress).toContain(mine.uid);
            expect(inProgress).not.toContain(theirs.uid);

            // Still on the shared project's own list
            const all = await memberAgent.get(
                `/api/tasks?type=all&project_id=${project.id}`
            );
            expect(all.body.tasks.map((t) => t.uid)).toEqual(
                expect.arrayContaining([mine.uid, theirs.uid])
            );
        });
    });

    describe('an area shared with a group', () => {
        let group, project;

        beforeEach(async () => {
            group = await UserGroup.create({ name: 'Team' });
            await UserGroupMember.create({
                group_id: group.id,
                user_id: member.id,
            });
            await ownerAgent.post('/api/shares').send({
                resource_type: 'area',
                resource_uid: area.uid,
                target_group_uid: group.uid,
                access_level: 'rw',
            });
            await acceptAllInvitations(memberAgent);

            project = await createProject({
                name: 'Acme website',
                area_id: area.id,
            });
        });

        const groupRowsOnProject = () =>
            GroupPermission.count({
                where: { user_id: member.id, resource_uid: project.uid },
            });

        it('takes group access back when the project moves out', async () => {
            expect(await memberCanOpen(project)).toBe(true);

            await ownerAgent
                .patch(`/api/project/${project.uid}`)
                .send({ area_id: otherArea.id });

            expect(await memberCanOpen(project)).toBe(false);
            expect(await groupRowsOnProject()).toBe(0);
        });

        it('takes group access back when the project is restricted', async () => {
            expect(await memberCanOpen(project)).toBe(true);

            await ownerAgent
                .patch(`/api/project/${project.uid}`)
                .send({ visibility: 'restricted' });

            expect(await memberCanOpen(project)).toBe(false);
            expect(await groupRowsOnProject()).toBe(0);
        });
    });
});
