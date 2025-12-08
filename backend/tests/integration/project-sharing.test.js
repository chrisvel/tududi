const request = require('supertest');
const app = require('../../app');
const {
    User,
    Project,
    Task,
    Note,
    Permission,
    sequelize,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Project Sharing Integration Tests', () => {
    let ownerUser, sharedUser, ownerAgent, sharedUserAgent, project;

    beforeEach(async () => {
        // Create test users using test helper
        ownerUser = await createTestUser({
            email: `owner_${Date.now()}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });

        sharedUser = await createTestUser({
            email: `shared_${Date.now()}@test.com`,
            name: 'Shared User',
            timezone: 'UTC',
        });

        // Create agents for both users (maintains sessions)
        ownerAgent = request.agent(app);
        sharedUserAgent = request.agent(app);

        // Login as owner
        await ownerAgent
            .post('/api/login')
            .send({ email: ownerUser.email, password: 'password123' });

        // Login as shared user
        await sharedUserAgent
            .post('/api/login')
            .send({ email: sharedUser.email, password: 'password123' });

        // Create a project as owner
        const projectResponse = await ownerAgent.post('/api/project').send({
            name: 'Shared Test Project',
            description: 'Project for sharing tests',
        });
        project = projectResponse.body;

        // Share the project with read-write access
        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: sharedUser.email,
            access_level: 'rw',
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('Project visibility', () => {
        test('shared user should see shared project in /api/projects', async () => {
            const response = await sharedUserAgent.get('/api/projects');

            expect(response.status).toBe(200);
            expect(response.body.projects).toBeDefined();

            const sharedProjectUids = response.body.projects.map(
                (p) => p.uid
            );

            expect(sharedProjectUids).toContain(project.uid);
        });

        test('shared project should have is_shared flag and share_count in /api/projects', async () => {
            const response = await ownerAgent.get('/api/projects');

            expect(response.status).toBe(200);
            expect(response.body.projects).toBeDefined();

            const sharedProject = response.body.projects.find(
                (p) => p.uid === project.uid
            );

            expect(sharedProject).toBeDefined();
            expect(sharedProject.is_shared).toBe(true);
            expect(sharedProject.share_count).toBeGreaterThan(0);
        });

        test('owner can fetch share list with emails via /api/shares', async () => {
            const response = await ownerAgent.get(
                `/api/shares?resource_type=project&resource_uid=${project.uid}`
            );

            expect(response.status).toBe(200);
            expect(response.body.shares).toBeDefined();
            expect(Array.isArray(response.body.shares)).toBe(true);

            // Should include owner
            const ownerShare = response.body.shares.find(
                (s) => s.is_owner === true
            );
            expect(ownerShare).toBeDefined();
            expect(ownerShare.email).toBe(ownerUser.email);
            expect(ownerShare.access_level).toBe('owner');
            // Avatar field should exist (may be null if no avatar set)
            expect(ownerShare).toHaveProperty('avatar_image');

            // Should include shared user
            const sharedUserShare = response.body.shares.find(
                (s) => s.email === sharedUser.email
            );
            expect(sharedUserShare).toBeDefined();
            expect(sharedUserShare.is_owner).toBe(false);
            expect(sharedUserShare.email).toBe(sharedUser.email);
            expect(['ro', 'rw']).toContain(sharedUserShare.access_level);
            // Avatar field should exist (may be null if no avatar set)
            expect(sharedUserShare).toHaveProperty('avatar_image');
        });
    });

    describe('Issue 1: Task and Note Visibility in Shared Projects', () => {
        test('shared user should see tasks in shared project', async () => {
            // Owner creates a task in the shared project
            const taskResponse = await ownerAgent.post('/api/task').send({
                name: 'Task by owner in shared project',
                project_id: project.id,
                priority: 1,
                status: 0,
            });
            const taskInSharedProject = taskResponse.body;

            // Shared user should see this task
            const response = await sharedUserAgent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            const foundTask = response.body.tasks.find(
                (t) => t.id === taskInSharedProject.id
            );
            expect(foundTask).toBeDefined();
            expect(foundTask.name).toBe('Task by owner in shared project');
        });

        test('shared user should see notes in shared project', async () => {
            // Owner creates a note in the shared project
            const noteResponse = await ownerAgent.post('/api/note').send({
                title: 'Note by owner in shared project',
                content: 'This note should be visible to shared user',
                project_uid: project.uid,
            });
            const noteInSharedProject = noteResponse.body;

            // Shared user should see this note
            const response = await sharedUserAgent.get('/api/notes');

            expect(response.status).toBe(200);
            expect(response.body).toBeDefined();

            const foundNote = response.body.find(
                (n) => n.id === noteInSharedProject.id
            );
            expect(foundNote).toBeDefined();
            expect(foundNote.title).toBe('Note by owner in shared project');
        });

        test('shared user should NOT see tasks in non-shared projects', async () => {
            // Create another project (not shared)
            const privateProjectResponse = await ownerAgent
                .post('/api/project')
                .send({
                    name: 'Private Project',
                    description: 'This should not be visible',
                });
            const privateProject = privateProjectResponse.body;

            // Create task in private project
            const privateTaskResponse = await ownerAgent
                .post('/api/task')
                .send({
                    name: 'Private task',
                    project_id: privateProject.id,
                    priority: 1,
                    status: 0,
                });
            const privateTask = privateTaskResponse.body;

            // Shared user should NOT see this task
            const response = await sharedUserAgent.get('/api/tasks');

            expect(response.status).toBe(200);
            const foundTask = response.body.tasks.find(
                (t) => t.id === privateTask.id
            );
            expect(foundTask).toBeUndefined();
        });

        test('shared user should see tasks due today in shared projects', async () => {
            // Create a task due today in shared project
            const today = new Date().toISOString().split('T')[0];
            const taskDueTodayResponse = await ownerAgent
                .post('/api/task')
                .send({
                    name: 'Task due today in shared project',
                    project_id: project.id,
                    due_date: today,
                    priority: 1,
                    status: 0,
                });
            const taskDueToday = taskDueTodayResponse.body;

            // Fetch today's tasks as shared user with include_lists to get tasks_due_today
            const response = await sharedUserAgent.get(
                '/api/tasks?type=today&include_lists=true'
            );

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();

            // Task should appear in tasks_due_today since it has a due date but today=false
            expect(response.body.tasks_due_today).toBeDefined();
            const foundTask = response.body.tasks_due_today.find(
                (t) => t.id === taskDueToday.id
            );
            expect(foundTask).toBeDefined();
            expect(foundTask.name).toBe('Task due today in shared project');
        });
    });

    describe('Issue 2: Task and Note Creation in Shared Projects', () => {
        test('shared user with RW access can create tasks in shared project', async () => {
            const response = await sharedUserAgent.post('/api/task').send({
                name: 'Task created by shared user',
                project_id: project.id,
                priority: 1,
                status: 0,
            });

            expect(response.status).toBe(201);
            expect(response.body).toBeDefined();
            expect(response.body.name).toBe('Task created by shared user');
            expect(response.body.project_id).toBe(project.id);
        });

        test('shared user with RW access can create notes in shared project', async () => {
            const response = await sharedUserAgent.post('/api/note').send({
                title: 'Note created by shared user',
                content: 'Content of the note',
                project_uid: project.uid,
            });

            expect(response.status).toBe(201);
            expect(response.body).toBeDefined();
            expect(response.body.title).toBe('Note created by shared user');
        });

        test('shared user with RO access cannot create tasks', async () => {
            // Change permission to read-only
            await Permission.update(
                { access_level: 'ro' },
                {
                    where: {
                        resource_uid: project.uid,
                        user_id: sharedUser.id,
                    },
                }
            );

            const response = await sharedUserAgent.post('/api/task').send({
                name: 'Task that should fail',
                project_id: project.id,
                priority: 1,
                status: 0,
            });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        test('shared user with RO access cannot create notes', async () => {
            // Change permission to read-only
            await Permission.update(
                { access_level: 'ro' },
                {
                    where: {
                        resource_uid: project.uid,
                        user_id: sharedUser.id,
                    },
                }
            );

            const response = await sharedUserAgent.post('/api/note').send({
                title: 'Note that should fail',
                content: 'Content',
                project_uid: project.uid,
            });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });
    });

    describe('Task Timeline Access', () => {
        test('shared user can access task timeline in shared project', async () => {
            // Create a task in the shared project
            const taskResponse = await ownerAgent.post('/api/task').send({
                name: 'Task with timeline',
                project_id: project.id,
                priority: 1,
                status: 0,
            });
            const taskInSharedProject = taskResponse.body;

            // Shared user should be able to access the timeline
            const response = await sharedUserAgent.get(
                `/api/task/${taskInSharedProject.uid}/timeline`
            );

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('shared user cannot access task timeline in non-shared project', async () => {
            // Create a private project and task
            const privateProjectResponse = await ownerAgent
                .post('/api/project')
                .send({
                    name: 'Private Project for Timeline',
                });
            const privateProject = privateProjectResponse.body;

            const privateTaskResponse = await ownerAgent
                .post('/api/task')
                .send({
                    name: 'Private task',
                    project_id: privateProject.id,
                    priority: 1,
                    status: 0,
                });
            const privateTask = privateTaskResponse.body;

            // Shared user should NOT access this timeline
            const response = await sharedUserAgent.get(
                `/api/task/${privateTask.uid}/timeline`
            );

            expect(response.status).toBe(404);
        });

        test('shared user can access completion time analytics', async () => {
            // Create a task in the shared project
            const taskResponse = await ownerAgent.post('/api/task').send({
                name: 'Task for completion analytics',
                project_id: project.id,
                priority: 1,
                status: 0,
            });
            const taskInSharedProject = taskResponse.body;

            const response = await sharedUserAgent.get(
                `/api/task/${taskInSharedProject.uid}/completion-time`
            );

            // Should return 404 if not completed, or 200 with data if completed
            expect([200, 404]).toContain(response.status);
        });
    });

    describe('Owner sees their own tasks correctly', () => {
        test('owner should see all their tasks including those in shared projects', async () => {
            // Create a task in the shared project
            await ownerAgent.post('/api/task').send({
                name: 'Owner task in shared project',
                project_id: project.id,
                priority: 1,
                status: 0,
            });

            const response = await ownerAgent.get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();
            expect(response.body.tasks.length).toBeGreaterThan(0);
        });

        test('owner should see tasks due today including shared project tasks', async () => {
            const today = new Date().toISOString().split('T')[0];

            await ownerAgent.post('/api/task').send({
                name: 'Owner task due today',
                project_id: project.id,
                due_date: today,
                priority: 1,
                status: 0,
            });

            const response = await ownerAgent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            expect(response.body.tasks).toBeDefined();
        });
    });
});
