const request = require('supertest');
const app = require('../../app');
const {
    sequelize,
    Area,
    Project,
    Person,
    UserGroup,
    UserGroupMember,
} = require('../../models');
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

    describe('access that does not come from a direct project share', () => {
        let areaProject;

        beforeEach(async () => {
            const area = await Area.create({
                name: 'Home',
                user_id: ownerUser.id,
            });
            areaProject = await Project.create({
                name: 'Renovation',
                user_id: ownerUser.id,
                area_id: area.id,
            });

            for (const target of [sharedUser, outsiderUser]) {
                await ownerAgent.post('/api/shares').send({
                    resource_type: 'area',
                    resource_uid: area.uid,
                    target_user_email: target.email,
                    access_level: 'rw',
                });
            }
            await acceptAllInvitations(sharedUserAgent);
            await acceptAllInvitations(outsiderAgent);
        });

        const namesFor = async (agent, projectUid) => {
            const response = await agent.get(
                `/api/projects/${projectUid}/assignable-people`
            );
            expect(response.status).toBe(200);
            return response.body.people.map((p) => p.name);
        };

        test('owner sees people who reach the project through an area share', async () => {
            const names = await namesFor(ownerAgent, areaProject.uid);

            expect(names).toContain('Shared');
            expect(names).toContain('Outsider');
        });

        test('a collaborator sees the other people sharing the same area', async () => {
            const names = await namesFor(sharedUserAgent, areaProject.uid);

            expect(names).toContain('Owner');
            expect(names).toContain('Outsider');
        });
    });

    describe('cards that point at an account', () => {
        test("a user's own contact card for a collaborator is not listed twice", async () => {
            await Person.create({
                user_id: ownerUser.id,
                linked_user_id: sharedUser.id,
                name: 'Sharie',
            });

            const response = await ownerAgent.get(
                `/api/projects/${project.uid}/assignable-people`
            );

            expect(response.status).toBe(200);
            const forSharedUser = response.body.people.filter(
                (p) => p.linked_user_id === sharedUser.id
            );
            expect(forSharedUser).toHaveLength(1);
        });

        test("offers only the collaborator's own person record", async () => {
            await Person.create({
                user_id: outsiderUser.id,
                linked_user_id: sharedUser.id,
                name: 'Secret Nickname',
                phone: '555-0100',
            });

            const response = await ownerAgent.get(
                `/api/projects/${project.uid}/assignable-people`
            );

            expect(response.status).toBe(200);
            const names = response.body.people.map((p) => p.name);
            expect(names).not.toContain('Secret Nickname');
        });
    });

    describe('assignable people outside a project', () => {
        const assignableNames = async (agent) => {
            const response = await agent.get('/api/people/assignable');
            expect(response.status).toBe(200);
            return response.body.people.map((p) => p.name);
        };

        test('includes people the caller shares something with', async () => {
            const names = await assignableNames(ownerAgent);

            expect(names).toContain('Shared');
            expect(names).not.toContain('Outsider');
        });

        test('includes people in the same group with nothing shared', async () => {
            const group = await UserGroup.create({ name: 'Family' });
            await UserGroupMember.bulkCreate([
                { group_id: group.id, user_id: sharedUser.id },
                { group_id: group.id, user_id: outsiderUser.id },
            ]);

            const names = await assignableNames(sharedUserAgent);

            expect(names).toContain('Outsider');
        });

        test("does not expose another member's phone, notes or email", async () => {
            await Person.update(
                { phone: '555-0100', notes: 'private note' },
                {
                    where: {
                        user_id: sharedUser.id,
                        linked_user_id: sharedUser.id,
                    },
                }
            );

            const response = await ownerAgent.get('/api/people/assignable');

            const shared = response.body.people.find(
                (p) => p.name === 'Shared'
            );
            expect(shared).toBeDefined();
            expect(shared.phone).toBeUndefined();
            expect(shared.notes).toBeUndefined();
            expect(shared.email).toBeUndefined();
        });
    });

    describe('linking a person to an account', () => {
        test('is refused for someone the caller does not work with', async () => {
            const response = await sharedUserAgent.post('/api/people').send({
                name: 'Stranger',
                linked_user_id: outsiderUser.id,
            });

            expect(response.status).toBe(403);
        });

        test('is allowed for someone the caller shares with', async () => {
            const response = await ownerAgent.post('/api/people').send({
                name: 'Sharie',
                linked_user_id: sharedUser.id,
            });

            expect(response.status).toBe(201);
        });
    });
});
