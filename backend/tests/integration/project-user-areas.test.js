const request = require('supertest');
const app = require('../../app');
const {
    User,
    Project,
    Area,
    UserProjectArea,
    Permission,
    sequelize,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('User-Specific Project-Area Assignments', () => {
    let userA, userB, userAAgent, userBAgent, areaA, areaB, project;

    beforeEach(async () => {
        // Create two test users
        userA = await createTestUser({
            email: `userA_${Date.now()}@test.com`,
            name: 'User A',
            timezone: 'UTC',
        });

        userB = await createTestUser({
            email: `userB_${Date.now()}@test.com`,
            name: 'User B',
            timezone: 'UTC',
        });

        // Create agents for both users
        userAAgent = request.agent(app);
        userBAgent = request.agent(app);

        // Login as both users
        await userAAgent
            .post('/api/login')
            .send({ email: userA.email, password: 'password123' });

        await userBAgent
            .post('/api/login')
            .send({ email: userB.email, password: 'password123' });

        // Create areas for both users
        const areaAResponse = await userAAgent.post('/api/areas').send({
            name: 'User A Area',
            description: 'Area for User A',
        });
        areaA = areaAResponse.body;

        const areaBResponse = await userBAgent.post('/api/areas').send({
            name: 'User B Area',
            description: 'Area for User B',
        });
        areaB = areaBResponse.body;
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('Independent Area Assignments', () => {
        test('User A and User B should be able to assign shared project to different areas', async () => {
            // User A creates a project and assigns it to their area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Shared Project',
                description: 'A project shared between users',
                area_id: areaA.id,
            });
            project = projectResponse.body;

            expect(projectResponse.status).toBe(201);

            // User A shares the project with User B
            await userAAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: userB.email,
                access_level: 'rw',
            });

            // User A should see the project in their area
            const userAProjects = await userAAgent.get('/api/projects');
            const userAProject = userAProjects.body.projects.find(
                (p) => p.uid === project.uid
            );
            expect(userAProject).toBeDefined();
            expect(userAProject.Area).toBeDefined();
            expect(userAProject.Area.id).toBe(areaA.id);

            // User B assigns the project to their area
            await userBAgent.patch(`/api/project/${project.uid}`).send({
                area_id: areaB.id,
            });

            // User A should still see the project in their area (Area A)
            const userAProjectsAfter = await userAAgent.get('/api/projects');
            const userAProjectAfter = userAProjectsAfter.body.projects.find(
                (p) => p.uid === project.uid
            );
            expect(userAProjectAfter).toBeDefined();
            expect(userAProjectAfter.Area).toBeDefined();
            expect(userAProjectAfter.Area.id).toBe(areaA.id);
            expect(userAProjectAfter.Area.name).toBe('User A Area');

            // User B should see the project in their area (Area B)
            const userBProjects = await userBAgent.get('/api/projects');
            const userBProject = userBProjects.body.projects.find(
                (p) => p.uid === project.uid
            );
            expect(userBProject).toBeDefined();
            expect(userBProject.Area).toBeDefined();
            expect(userBProject.Area.id).toBe(areaB.id);
            expect(userBProject.Area.name).toBe('User B Area');
        });

        test('Shared user without area assignment should see project with no area', async () => {
            // User A creates a project with an area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Project with Area',
                area_id: areaA.id,
            });
            project = projectResponse.body;

            // User A shares the project with User B
            await userAAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: userB.email,
                access_level: 'rw',
            });

            // User B should see the project with no area (until they assign it)
            const userBProjects = await userBAgent.get('/api/projects');
            const userBProject = userBProjects.body.projects.find(
                (p) => p.uid === project.uid
            );
            expect(userBProject).toBeDefined();
            expect(userBProject.Area).toBeNull();
        });
    });

    describe('Area Ownership Validation', () => {
        test("User should not be able to assign project to another user's area", async () => {
            // User A creates a project
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Test Project',
            });
            project = projectResponse.body;

            // User A tries to assign project to User B's area (should fail)
            const updateResponse = await userAAgent
                .patch(`/api/project/${project.uid}`)
                .send({
                    area_id: areaB.id,
                });

            expect(updateResponse.status).toBe(400);
            expect(updateResponse.body.error).toBe('ValidationError');
            expect(updateResponse.body.message).toContain(
                'Area not found or does not belong to you'
            );
        });

        test("User should not be able to create project with another user's area", async () => {
            // User A tries to create a project assigned to User B's area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Invalid Project',
                area_id: areaB.id,
            });

            expect(projectResponse.status).toBe(400);
            expect(projectResponse.body.error).toBe('ValidationError');
            expect(projectResponse.body.message).toContain(
                'Area not found or does not belong to you'
            );
        });
    });

    describe('Null Area Handling', () => {
        test('Creating project without area should not create user_project_areas entry', async () => {
            // User A creates a project without area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Project Without Area',
            });
            project = projectResponse.body;

            expect(projectResponse.status).toBe(201);

            // Check that no user_project_areas entry exists
            const dbProject = await Project.findOne({
                where: { uid: project.uid },
            });
            const userProjectArea = await UserProjectArea.findOne({
                where: { user_id: userA.id, project_id: dbProject.id },
            });
            expect(userProjectArea).toBeNull();
        });

        test('Updating project to add area should create user_project_areas entry', async () => {
            // User A creates a project without area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Project Without Area',
            });
            project = projectResponse.body;

            // User A adds an area
            await userAAgent.patch(`/api/project/${project.uid}`).send({
                area_id: areaA.id,
            });

            // Check that user_project_areas entry was created
            const dbProject = await Project.findOne({
                where: { uid: project.uid },
            });
            const userProjectArea = await UserProjectArea.findOne({
                where: { user_id: userA.id, project_id: dbProject.id },
            });
            expect(userProjectArea).not.toBeNull();
            expect(userProjectArea.area_id).toBe(areaA.id);
        });

        test('Updating project to remove area should delete user_project_areas entry', async () => {
            // User A creates a project with area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Project With Area',
                area_id: areaA.id,
            });
            project = projectResponse.body;

            // User A removes the area
            await userAAgent.patch(`/api/project/${project.uid}`).send({
                area_id: null,
            });

            // Check that user_project_areas entry was deleted
            const dbProject = await Project.findOne({
                where: { uid: project.uid },
            });
            const userProjectArea = await UserProjectArea.findOne({
                where: { user_id: userA.id, project_id: dbProject.id },
            });
            expect(userProjectArea).toBeNull();
        });
    });

    describe('Cascade Deletion', () => {
        test('Deleting area should remove user_project_areas entries', async () => {
            // User A creates a project with area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Project With Area',
                area_id: areaA.id,
            });
            project = projectResponse.body;

            const dbProject = await Project.findOne({
                where: { uid: project.uid },
            });

            // Verify user_project_areas entry exists
            let userProjectArea = await UserProjectArea.findOne({
                where: { user_id: userA.id, project_id: dbProject.id },
            });
            expect(userProjectArea).not.toBeNull();

            // Delete the area
            await userAAgent.delete(`/api/areas/${areaA.uid}`);

            // Verify user_project_areas entry was deleted via CASCADE
            userProjectArea = await UserProjectArea.findOne({
                where: { user_id: userA.id, project_id: dbProject.id },
            });
            expect(userProjectArea).toBeNull();

            // Project should still exist
            const projectStillExists = await Project.findOne({
                where: { uid: project.uid },
            });
            expect(projectStillExists).not.toBeNull();
        });

        test('Deleting project should remove user_project_areas entries', async () => {
            // User A creates a project with area
            const projectResponse = await userAAgent.post('/api/project').send({
                name: 'Project With Area',
                area_id: areaA.id,
            });
            project = projectResponse.body;

            const dbProject = await Project.findOne({
                where: { uid: project.uid },
            });

            // Verify user_project_areas entry exists
            let userProjectArea = await UserProjectArea.findOne({
                where: { user_id: userA.id, project_id: dbProject.id },
            });
            expect(userProjectArea).not.toBeNull();

            // Delete the project
            await userAAgent.delete(`/api/project/${project.uid}`);

            // Verify user_project_areas entry was deleted via CASCADE
            userProjectArea = await UserProjectArea.findOne({
                where: { user_id: userA.id, project_id: dbProject.id },
            });
            expect(userProjectArea).toBeNull();
        });
    });

    describe('Filtering and Grouping', () => {
        test("Filtering projects by area should return only user's assignments", async () => {
            // User A creates two projects: one with area, one without
            const project1Response = await userAAgent
                .post('/api/project')
                .send({
                    name: 'Project in Area A',
                    area_id: areaA.id,
                });
            const project1 = project1Response.body;

            const project2Response = await userAAgent
                .post('/api/project')
                .send({
                    name: 'Project without Area',
                });
            const project2 = project2Response.body;

            // Filter by Area A
            const filteredProjects = await userAAgent.get(
                `/api/projects?area=${areaA.uid}`
            );

            expect(filteredProjects.body.projects).toBeDefined();
            expect(filteredProjects.body.projects.length).toBe(1);
            expect(filteredProjects.body.projects[0].uid).toBe(project1.uid);
        });

        test("Grouping projects by area should group by user's assignments", async () => {
            // User A creates projects with and without area
            await userAAgent.post('/api/project').send({
                name: 'Project in Area A',
                area_id: areaA.id,
            });

            await userAAgent.post('/api/project').send({
                name: 'Project without Area',
            });

            // Get grouped projects
            const groupedProjects = await userAAgent.get(
                '/api/projects?grouped=true'
            );

            expect(groupedProjects.body).toBeDefined();
            expect(groupedProjects.body['User A Area']).toBeDefined();
            expect(groupedProjects.body['User A Area'].length).toBe(1);
            expect(groupedProjects.body['No Area']).toBeDefined();
            expect(
                groupedProjects.body['No Area'].length
            ).toBeGreaterThanOrEqual(1);
        });
    });
});
