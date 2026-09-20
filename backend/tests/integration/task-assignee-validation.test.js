const request = require('supertest');
const app = require('../../app');
const { Person, Task } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

describe('Task assignee validation', () => {
    let ownerUser, collaboratorUser, outsiderUser;
    let ownerAgent, collaboratorAgent;
    let outsiderSelf, collaboratorSelf, ownerSelf;
    let project;

    const login = async (user) => {
        const agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        return agent;
    };

    beforeEach(async () => {
        const stamp = Date.now();
        ownerUser = await createTestUser({
            email: `assign-owner_${stamp}@test.com`,
            name: 'Owner',
        });
        collaboratorUser = await createTestUser({
            email: `assign-collab_${stamp}@test.com`,
            name: 'Collaborator',
        });
        outsiderUser = await createTestUser({
            email: `assign-outsider_${stamp}@test.com`,
            name: 'Outsider',
        });

        ownerSelf = await peopleService.createSelfPerson(ownerUser);
        collaboratorSelf =
            await peopleService.createSelfPerson(collaboratorUser);
        outsiderSelf = await peopleService.createSelfPerson(outsiderUser);

        ownerAgent = await login(ownerUser);
        collaboratorAgent = await login(collaboratorUser);

        const projectResponse = await ownerAgent
            .post('/api/project')
            .send({ name: 'Assignee project' });
        project = projectResponse.body;

        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: collaboratorUser.email,
            access_level: 'rw',
        });
        await acceptAllInvitations(collaboratorAgent);
    });

    it("refuses to assign a task to someone else's person the caller cannot reach", async () => {
        const response = await ownerAgent
            .post('/api/task')
            .send({ name: 'Sneaky', assigned_to: outsiderSelf.uid });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid assignee.');
        expect(await Task.count({ where: { name: 'Sneaky' } })).toBe(0);
    });

    it('refuses an unknown person uid', async () => {
        const response = await ownerAgent
            .post('/api/task')
            .send({ name: 'Ghost', assigned_to: 'doesnotexist123' });

        expect(response.status).toBe(400);
    });

    it("refuses another user's non-self contact card", async () => {
        const card = await Person.create({
            user_id: outsiderUser.id,
            name: 'Private contact',
            linked_user_id: ownerUser.id,
        });

        const response = await ownerAgent
            .post('/api/task')
            .send({ name: 'Via card', assigned_to: card.uid });

        expect(response.status).toBe(400);
    });

    it('allows assigning to one of the callers own people', async () => {
        const mine = await Person.create({
            user_id: ownerUser.id,
            name: 'My contact',
        });

        const response = await ownerAgent
            .post('/api/task')
            .send({ name: 'Mine', assigned_to: mine.uid });

        expect(response.status).toBe(201);
        expect(response.body.assigned_to).toBe(mine.uid);
    });

    it('allows assigning a project task to a collaborator of that project', async () => {
        const response = await ownerAgent.post('/api/task').send({
            name: 'Shared work',
            project_uid: project.uid,
            assigned_to: collaboratorSelf.uid,
        });

        expect(response.status).toBe(201);
        expect(response.body.assigned_to).toBe(collaboratorSelf.uid);
    });

    it('allows a collaborator to assign to the project owner', async () => {
        const response = await collaboratorAgent.post('/api/task').send({
            name: 'Back to owner',
            project_uid: project.uid,
            assigned_to: ownerSelf.uid,
        });

        expect(response.status).toBe(201);
    });

    it('validates the assignee when a task is updated', async () => {
        const created = await ownerAgent
            .post('/api/task')
            .send({ name: 'Updatable' });

        const response = await ownerAgent
            .patch(`/api/task/${created.body.uid}`)
            .send({ assigned_to: outsiderSelf.uid });

        expect(response.status).toBe(400);
        const stored = await Task.findOne({ where: { uid: created.body.uid } });
        expect(stored.assigned_to).toBeNull();
    });

    it('lets an existing assignee stay and lets the task be unassigned', async () => {
        const created = await ownerAgent.post('/api/task').send({
            name: 'Keep and clear',
            project_uid: project.uid,
            assigned_to: collaboratorSelf.uid,
        });

        const keep = await ownerAgent
            .patch(`/api/task/${created.body.uid}`)
            .send({ name: 'Renamed', assigned_to: collaboratorSelf.uid });
        expect(keep.status).toBe(200);

        const clear = await ownerAgent
            .patch(`/api/task/${created.body.uid}`)
            .send({ assigned_to: null });
        expect(clear.status).toBe(200);
        expect(clear.body.assigned_to).toBeNull();
    });
});
