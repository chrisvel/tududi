const request = require('supertest');
const app = require('../../app');
const { Area, Project, Task, Note } = require('../../models');
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

const search = async (agent, q, types = 'Task') => {
    const res = await agent.get('/api/search').query({ q, filters: types });
    expect(res.status).toBe(200);
    return res.body.results;
};

const names = (results) => results.map((r) => r.name);

// Universal search returns what the user can open, not only their own rows
// (#2014).
describe('Search includes shared and assigned items', () => {
    let owner, member, stranger, ownerAgent, memberAgent;

    const share = async (resourceType, uid, accessLevel = 'rw') => {
        const res = await ownerAgent.post('/api/shares').send({
            resource_type: resourceType,
            resource_uid: uid,
            target_user_email: member.email,
            access_level: accessLevel,
        });
        expect([200, 201, 204]).toContain(res.status);
        await acceptAllInvitations(memberAgent);
    };

    beforeEach(async () => {
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        // Created one at a time: the first user becomes admin.
        owner = await createTestUser({ email: `owner_${stamp}@example.com` });
        member = await createTestUser({
            email: `member_${stamp}@example.com`,
        });
        stranger = await createTestUser({
            email: `stranger_${stamp}@example.com`,
        });
        ownerAgent = await login(owner);
        memberAgent = await login(member);
    });

    it('finds a task, the project and its note in a project shared with the user', async () => {
        const project = await Project.create({
            name: 'Harbour quay',
            user_id: owner.id,
        });
        await Task.create({
            name: 'Pour quay foundations',
            user_id: owner.id,
            project_id: project.id,
        });
        await Note.create({
            title: 'Quay survey notes',
            user_id: owner.id,
            project_id: project.id,
        });
        await share('project', project.uid);

        expect(names(await search(memberAgent, 'quay'))).toContain(
            'Pour quay foundations'
        );
        expect(names(await search(memberAgent, 'quay', 'Project'))).toContain(
            'Harbour quay'
        );
        expect(names(await search(memberAgent, 'quay', 'Note'))).toContain(
            'Quay survey notes'
        );
    });

    it('finds tasks and the area itself when an area is shared with the user', async () => {
        const area = await Area.create({
            name: 'Riverside scheme',
            user_id: owner.id,
        });
        await share('area', area.uid);

        const created = await ownerAgent
            .post('/api/project')
            .send({ name: 'Riverside phase one', area_id: area.id });
        expect(created.status).toBe(201);
        const project = await Project.findOne({
            where: { uid: created.body.uid },
        });
        await Task.create({
            name: 'Riverside planning permit',
            user_id: owner.id,
            project_id: project.id,
        });
        await Task.create({
            name: 'Riverside loose errand',
            user_id: owner.id,
            area_id: area.id,
        });

        const found = names(await search(memberAgent, 'riverside'));
        expect(found).toContain('Riverside planning permit');
        expect(found).toContain('Riverside loose errand');
        expect(names(await search(memberAgent, 'riverside', 'Area'))).toContain(
            'Riverside scheme'
        );
    });

    it('lets the area owner find tasks a collaborator created in their area', async () => {
        const area = await Area.create({
            name: 'Northline',
            user_id: owner.id,
        });
        await share('area', area.uid);

        const project = await Project.create({
            name: 'Northline fit-out',
            user_id: member.id,
            area_id: area.id,
        });
        await Task.create({
            name: 'Order northline fixtures',
            user_id: member.id,
            project_id: project.id,
        });

        expect(names(await search(ownerAgent, 'northline'))).toContain(
            'Order northline fixtures'
        );
    });

    it('finds a task assigned to the user in a project they cannot otherwise see', async () => {
        const memberPerson = await peopleService.createSelfPerson(member);
        const project = await Project.create({
            name: 'Private build',
            user_id: owner.id,
        });
        await Task.create({
            name: 'Sign off scaffolding',
            user_id: owner.id,
            project_id: project.id,
            assigned_to: memberPerson.uid,
        });
        await Task.create({
            name: 'Sign off budget',
            user_id: owner.id,
            project_id: project.id,
        });

        const found = names(await search(memberAgent, 'sign off'));
        expect(found).toContain('Sign off scaffolding');
        expect(found).not.toContain('Sign off budget');
    });

    it("does not return another user's private items", async () => {
        const project = await Project.create({
            name: 'Secret venture',
            user_id: stranger.id,
        });
        await Task.create({
            name: 'Secret venture task',
            user_id: stranger.id,
            project_id: project.id,
        });
        await Note.create({
            title: 'Secret venture note',
            user_id: stranger.id,
        });
        await Area.create({
            name: 'Secret venture area',
            user_id: stranger.id,
        });

        const res = await memberAgent
            .get('/api/search')
            .query({ q: 'secret venture', limit: 20, offset: 0 });
        expect(res.status).toBe(200);
        expect(res.body.results).toEqual([]);
        expect(res.body.pagination.total).toBe(0);
    });

    it('counts shared tasks in the paginated total', async () => {
        const project = await Project.create({
            name: 'Counted',
            user_id: owner.id,
        });
        await Task.create({
            name: 'Counted shared one',
            user_id: owner.id,
            project_id: project.id,
        });
        await Task.create({
            name: 'Counted own one',
            user_id: member.id,
        });
        await share('project', project.uid);

        const res = await memberAgent
            .get('/api/search')
            .query({ q: 'counted', filters: 'Task', limit: 1, offset: 0 });
        expect(res.status).toBe(200);
        expect(res.body.results).toHaveLength(1);
        expect(res.body.pagination.total).toBe(2);
        expect(res.body.pagination.hasMore).toBe(true);
    });
});
