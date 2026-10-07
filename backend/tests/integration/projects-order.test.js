const request = require('supertest');
const app = require('../../app');
const { Project, UserProjectOrder, sequelize } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

describe('Projects custom order', () => {
    let owner, member, ownerAgent, memberAgent, projects;

    const orderOf = (body) =>
        body.projects
            .filter((p) => p.sort_position !== null)
            .sort((a, b) => a.sort_position - b.sort_position)
            .map((p) => p.uid);

    beforeEach(async () => {
        owner = await createTestUser({ email: `owner_${Date.now()}@test.com` });
        member = await createTestUser({
            email: `member_${Date.now()}@test.com`,
        });
        ownerAgent = request.agent(app);
        memberAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });
        await memberAgent
            .post('/api/login')
            .send({ email: member.email, password: 'password123' });

        projects = [];
        for (const name of ['A', 'B', 'C']) {
            const res = await ownerAgent.post('/api/project').send({ name });
            projects.push(res.body);
        }
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('returns null sort_position before any reorder', async () => {
        const res = await ownerAgent.get('/api/projects');
        expect(res.status).toBe(200);
        res.body.projects.forEach((p) => expect(p.sort_position).toBeNull());
    });

    it('saves and returns the custom order', async () => {
        const order = [projects[2].uid, projects[0].uid, projects[1].uid];
        const put = await ownerAgent
            .put('/api/projects/order')
            .send({ project_uids: order });
        expect(put.status).toBe(200);
        expect(put.body.project_uids).toEqual(order);

        const res = await ownerAgent.get('/api/projects');
        expect(orderOf(res.body)).toEqual(order);

        const reversed = [...order].reverse();
        await ownerAgent
            .put('/api/projects/order')
            .send({ project_uids: reversed });
        const again = await ownerAgent.get('/api/projects');
        expect(orderOf(again.body)).toEqual(reversed);
    });

    it('keeps the order per user for a shared project', async () => {
        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: projects[0].uid,
            target_user_email: member.email,
            access_level: 'ro',
        });
        await acceptAllInvitations(memberAgent);

        await ownerAgent.put('/api/projects/order').send({
            project_uids: projects.map((p) => p.uid),
        });
        const res = await memberAgent
            .put('/api/projects/order')
            .send({ project_uids: [projects[0].uid] });
        expect(res.status).toBe(200);

        const ownerList = await ownerAgent.get('/api/projects');
        expect(orderOf(ownerList.body)).toEqual(projects.map((p) => p.uid));
        const memberList = await memberAgent.get('/api/projects');
        expect(orderOf(memberList.body)).toEqual([projects[0].uid]);
    });

    it('rejects projects the user cannot see', async () => {
        const res = await memberAgent
            .put('/api/projects/order')
            .send({ project_uids: [projects[0].uid] });
        expect(res.status).toBe(404);
        expect(await UserProjectOrder.count()).toBe(0);
    });

    it('rejects invalid payloads', async () => {
        const missing = await ownerAgent.put('/api/projects/order').send({});
        expect(missing.status).toBe(400);

        const dupes = await ownerAgent.put('/api/projects/order').send({
            project_uids: [projects[0].uid, projects[0].uid],
        });
        expect(dupes.status).toBe(400);

        const notStrings = await ownerAgent
            .put('/api/projects/order')
            .send({ project_uids: [1, 2] });
        expect(notStrings.status).toBe(400);
    });

    it('requires authentication', async () => {
        const res = await request(app)
            .put('/api/projects/order')
            .send({ project_uids: [] });
        expect(res.status).toBe(401);
    });

    it('drops order rows when a project is deleted', async () => {
        await ownerAgent.put('/api/projects/order').send({
            project_uids: projects.map((p) => p.uid),
        });
        const del = await ownerAgent.delete(`/api/project/${projects[1].uid}`);
        expect(del.status).toBe(200);

        const project = await Project.findOne({
            where: { uid: projects[0].uid },
        });
        expect(project).not.toBeNull();
        expect(await UserProjectOrder.count()).toBe(2);
    });
});
