const request = require('supertest');
const app = require('../../app');
const { Project, User, Area } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Projects Routes', () => {
    let user, area, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        area = await Area.create({
            name: 'Work',
            user_id: user.id,
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/project', () => {
        it('should create a new project', async () => {
            const projectData = {
                name: 'Test Project',
                description: 'Test Description',
                active: true,
                pin_to_sidebar: false,
                priority: 1,
                area_id: area.id,
            };

            const response = await agent.post('/api/project').send(projectData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe(projectData.name);
            expect(response.body.description).toBe(projectData.description);
            expect(response.body.active).toBe(projectData.active);
            expect(response.body.pin_to_sidebar).toBe(
                projectData.pin_to_sidebar
            );
            expect(response.body.priority).toBe(projectData.priority);
            expect(response.body.area_id).toBe(area.id);
            expect(response.body.user_id).toBe(user.id);
        });

        it('should require authentication', async () => {
            const projectData = {
                name: 'Test Project',
            };

            const response = await request(app)
                .post('/api/project')
                .send(projectData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require project name', async () => {
            const projectData = {
                description: 'Project without name',
            };

            const response = await agent.post('/api/project').send(projectData);

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/projects', () => {
        let project1, project2;

        beforeEach(async () => {
            project1 = await Project.create({
                name: 'Project 1',
                description: 'First project',
                user_id: user.id,
                area_id: area.id,
            });

            project2 = await Project.create({
                name: 'Project 2',
                description: 'Second project',
                user_id: user.id,
            });
        });

        it('should get all user projects', async () => {
            const response = await agent.get('/api/projects');

            expect(response.status).toBe(200);
            expect(response.body.projects).toBeDefined();
            expect(response.body.projects.length).toBe(2);
            expect(response.body.projects.map((p) => p.id)).toContain(
                project1.id
            );
            expect(response.body.projects.map((p) => p.id)).toContain(
                project2.id
            );
        });

        it('should include area information', async () => {
            const response = await agent.get('/api/projects');

            expect(response.status).toBe(200);
            const projectWithArea = response.body.projects.find(
                (p) => p.id === project1.id
            );
            expect(projectWithArea.Area).toBeDefined();
            expect(projectWithArea.Area.name).toBe(area.name);
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/projects');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/project/:id', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Test Project',
                description: 'Test Description',
                user_id: user.id,
                area_id: area.id,
            });
        });

        it('should get project by id', async () => {
            const response = await agent.get(`/api/project/${project.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(project.id);
            expect(response.body.name).toBe(project.name);
            expect(response.body.description).toBe(project.description);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await agent.get('/api/project/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found');
        });

        it("should not allow access to other user's projects", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherProject = await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
            });

            const response = await agent.get(`/api/project/${otherProject.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(
                `/api/project/${project.id}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/project/:id', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Test Project',
                description: 'Test Description',
                active: false,
                priority: 0,
                user_id: user.id,
            });
        });

        it('should update project', async () => {
            const updateData = {
                name: 'Updated Project',
                description: 'Updated Description',
                active: true,
                priority: 2,
            };

            const response = await agent
                .patch(`/api/project/${project.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.description).toBe(updateData.description);
            expect(response.body.active).toBe(updateData.active);
            expect(response.body.priority).toBe(updateData.priority);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await agent
                .patch('/api/project/999999')
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found.');
        });

        it("should not allow updating other user's projects", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherProject = await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
            });

            const response = await agent
                .patch(`/api/project/${otherProject.id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/project/${project.id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/project/:id', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
            });
        });

        it('should delete project', async () => {
            const response = await agent.delete(`/api/project/${project.id}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Project successfully deleted');

            // Verify project is deleted
            const deletedProject = await Project.findByPk(project.id);
            expect(deletedProject).toBeNull();
        });

        it('should return 404 for non-existent project', async () => {
            const response = await agent.delete('/api/project/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found.');
        });

        it("should not allow deleting other user's projects", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherProject = await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
            });

            const response = await agent.delete(
                `/api/project/${otherProject.id}`
            );

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(
                `/api/project/${project.id}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
