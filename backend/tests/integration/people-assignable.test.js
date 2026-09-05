const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

describe('Assignable people for shared projects', () => {
    let ownerUser, sharedUser, outsiderUser;
    let ownerAgent, sharedUserAgent, outsiderAgent;
    let project;

    beforeEach(async () => {
        ownerUser = await createTestUser({
            email: `owner_${Date.now()}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });

        sharedUser = await createTestUser({
            email: `shared_${Date.now()}@test.com`,
            name: 'Shared',
            timezone: 'UTC',
        });

        outsiderUser = await createTestUser({
            email: `outsider_${Date.now()}@test.com`,
            name: 'Outsider',
            timezone: 'UTC',
        });

        // In the real app a self-person is created on registration; the
        // test helper creates users directly, so do it explicitly here.
        await peopleService.createSelfPerson(ownerUser);
        await peopleService.createSelfPerson(sharedUser);
        await peopleService.createSelfPerson(outsiderUser);

        ownerAgent = request.agent(app);
        sharedUserAgent = request.agent(app);
        outsiderAgent = request.agent(app);

        await ownerAgent
            .post('/api/login')
            .send({ email: ownerUser.email, password: 'password123' });
        await sharedUserAgent
            .post('/api/login')
            .send({ email: sharedUser.email, password: 'password123' });
        await outsiderAgent
            .post('/api/login')
            .send({ email: outsiderUser.email, password: 'password123' });

        const projectResponse = await ownerAgent.post('/api/project').send({
            name: 'Shared Assignable Project',
            description: 'Project for assignable-people tests',
        });
        project = projectResponse.body;

        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: sharedUser.email,
            access_level: 'rw',
        });
        await acceptAllInvitations(sharedUserAgent);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    test('owner sees the shared user as an assignable person', async () => {
        const response = await ownerAgent.get(
            `/api/projects/${project.uid}/assignable-people`
        );

        expect(response.status).toBe(200);
        const names = response.body.people.map((p) => p.name);
        expect(names).toContain('Shared');
    });

    test('shared user sees the owner as an assignable person', async () => {
        const response = await sharedUserAgent.get(
            `/api/projects/${project.uid}/assignable-people`
        );

        expect(response.status).toBe(200);
        const names = response.body.people.map((p) => p.name);
        expect(names).toContain('Owner');
    });

    test('user without access to the project is forbidden', async () => {
        const response = await outsiderAgent.get(
            `/api/projects/${project.uid}/assignable-people`
        );

        expect(response.status).toBe(403);
    });
});
