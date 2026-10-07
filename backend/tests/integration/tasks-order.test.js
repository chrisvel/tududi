const request = require('supertest');
const app = require('../../app');
const { UserTaskOrder, sequelize } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

describe('Tasks manual order', () => {
    let owner, member, ownerAgent, memberAgent, project, tasks;

    const listUids = async (agent, extra = '') => {
        const res = await agent.get(
            `/api/tasks?order_by=custom:asc&limit=50&offset=0${extra}`
        );
        expect(res.status).toBe(200);
        return res.body.tasks.map((t) => t.uid);
    };

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

        project = (await ownerAgent.post('/api/project').send({ name: 'P' }))
            .body;
        tasks = [];
        for (const name of ['A', 'B', 'C', 'D']) {
            const res = await ownerAgent
                .post('/api/task')
                .send({ name, project_uid: project.uid });
            tasks.push(res.body);
        }
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('sorts All Tasks by the saved order, unplaced tasks first', async () => {
        const [a, b, c, d] = tasks.map((t) => t.uid);
        const put = await ownerAgent
            .put('/api/tasks/order')
            .send({ scope: 'all', task_uids: [c, a] });
        expect(put.status).toBe(200);

        const uids = await listUids(ownerAgent);
        // b and d have no position yet, so they come first (newest first).
        expect(uids).toEqual([d, b, c, a]);

        const get = await ownerAgent.get('/api/tasks/order?scope=all');
        expect(get.body.task_uids).toEqual([c, a]);
    });

    it('moves only the visible tasks within their slots', async () => {
        const [a, b, c, d] = tasks.map((t) => t.uid);
        await ownerAgent
            .put('/api/tasks/order')
            .send({ scope: 'all', task_uids: [a, b, c, d] });
        // A filtered list showing b and d, with d dragged above b.
        await ownerAgent
            .put('/api/tasks/order')
            .send({ scope: 'all', task_uids: [d, b] });

        expect(await listUids(ownerAgent)).toEqual([a, d, c, b]);
    });

    it('starts from the base sort on a first drag under another sort', async () => {
        const [a, b, c, d] = tasks.map((t) => t.uid);
        // The page shows name order (a, b, c, d); only c and d are loaded
        // and d is dragged above c.
        const res = await ownerAgent.put('/api/tasks/order').send({
            scope: 'all',
            task_uids: [d, c],
            base_order_by: 'name:asc',
        });
        expect(res.status).toBe(200);
        expect(await listUids(ownerAgent)).toEqual([a, b, d, c]);

        const bad = await ownerAgent.put('/api/tasks/order').send({
            scope: 'all',
            task_uids: [d],
            base_order_by: 'custom:asc',
        });
        expect(bad.status).toBe(400);
    });

    it('keeps project order separate from All Tasks', async () => {
        const [a, b, c, d] = tasks.map((t) => t.uid);
        await ownerAgent.put('/api/tasks/order').send({
            scope: 'project',
            project_uid: project.uid,
            task_uids: [d, c, b, a],
        });

        const projectOrder = await ownerAgent.get(
            `/api/tasks/order?scope=project&project_uid=${project.uid}`
        );
        expect(projectOrder.body.task_uids).toEqual([d, c, b, a]);
        const allOrder = await ownerAgent.get('/api/tasks/order?scope=all');
        expect(allOrder.body.task_uids).toEqual([]);
    });

    it('keeps the order per user in a shared project', async () => {
        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: member.email,
            access_level: 'ro',
        });
        await acceptAllInvitations(memberAgent);
        const [a, b, c, d] = tasks.map((t) => t.uid);

        await ownerAgent.put('/api/tasks/order').send({
            scope: 'project',
            project_uid: project.uid,
            task_uids: [a, b, c, d],
        });
        const res = await memberAgent.put('/api/tasks/order').send({
            scope: 'project',
            project_uid: project.uid,
            task_uids: [d, c, b, a],
        });
        expect(res.status).toBe(200);

        const ownerOrder = await ownerAgent.get(
            `/api/tasks/order?scope=project&project_uid=${project.uid}`
        );
        expect(ownerOrder.body.task_uids).toEqual([a, b, c, d]);
    });

    it('rejects tasks and projects the user cannot see', async () => {
        const res = await memberAgent
            .put('/api/tasks/order')
            .send({ scope: 'all', task_uids: [tasks[0].uid] });
        expect(res.status).toBe(404);

        const project404 = await memberAgent.get(
            `/api/tasks/order?scope=project&project_uid=${project.uid}`
        );
        expect(project404.status).toBe(404);
        expect(await UserTaskOrder.count()).toBe(0);
    });

    it('rejects a task from another project in a project scope', async () => {
        const other = (
            await ownerAgent.post('/api/project').send({ name: 'Other' })
        ).body;
        const res = await ownerAgent.put('/api/tasks/order').send({
            scope: 'project',
            project_uid: other.uid,
            task_uids: [tasks[0].uid],
        });
        expect(res.status).toBe(404);
    });

    it('rejects invalid payloads', async () => {
        const badScope = await ownerAgent
            .put('/api/tasks/order')
            .send({ scope: 'x', task_uids: [] });
        expect(badScope.status).toBe(400);

        const dupes = await ownerAgent.put('/api/tasks/order').send({
            scope: 'all',
            task_uids: [tasks[0].uid, tasks[0].uid],
        });
        expect(dupes.status).toBe(400);

        const noProject = await ownerAgent
            .put('/api/tasks/order')
            .send({ scope: 'project', task_uids: [] });
        expect(noProject.status).toBe(400);
    });

    it('drops order rows when a task is deleted', async () => {
        await ownerAgent.put('/api/tasks/order').send({
            scope: 'all',
            task_uids: tasks.map((t) => t.uid),
        });
        const del = await ownerAgent.delete(`/api/task/${tasks[0].uid}`);
        expect(del.status).toBe(200);
        expect(await UserTaskOrder.count()).toBe(3);
    });
});
