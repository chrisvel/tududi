const request = require('supertest');
const app = require('../../app');
const path = require('path');
const fs = require('fs').promises;
const { Task, TaskAttachment, Project } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

describe('GET /api/uploads/:category/:filename', () => {
    const uploadsDir = path.join(__dirname, '../../uploads');

    let owner, ownerAgent, task;

    beforeEach(async () => {
        owner = await createTestUser({
            email: `uploads-owner_${Date.now()}@test.com`,
        });

        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });

        task = await Task.create({
            name: 'Task with a private attachment',
            user_id: owner.id,
        });
    });

    describe('task attachments', () => {
        const taskUploadDir = path.join(uploadsDir, 'tasks');
        let attachment;

        beforeEach(async () => {
            await fs.mkdir(taskUploadDir, { recursive: true });
            await fs.writeFile(
                path.join(taskUploadDir, 'task-static-test.pdf'),
                'private file content'
            );

            attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: owner.id,
                original_filename: 'private.pdf',
                stored_filename: 'task-static-test.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-static-test.pdf',
            });
        });

        afterEach(async () => {
            await fs.rm(taskUploadDir, { recursive: true, force: true });
        });

        it('should require authentication', async () => {
            const response = await request(app).get(
                `/api/uploads/tasks/${attachment.stored_filename}`
            );

            expect(response.status).toBe(401);
        });

        it('should allow the owner to fetch their own attachment', async () => {
            const response = await ownerAgent.get(
                `/api/uploads/tasks/${attachment.stored_filename}`
            );

            expect(response.status).toBe(200);
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });

        it("should allow a user shared on the task's project to fetch the attachment", async () => {
            // Tasks don't support direct sharing - they inherit access from
            // their parent project, so re-parent the task under a shared project.
            const project = await Project.create({
                name: 'Project for shared task attachment',
                user_id: owner.id,
            });
            await task.update({ project_id: project.id });

            const sharedUser = await createTestUser({
                email: `uploads-shared_${Date.now()}@test.com`,
            });
            const sharedAgent = request.agent(app);
            await sharedAgent
                .post('/api/login')
                .send({ email: sharedUser.email, password: 'password123' });

            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: sharedUser.email,
                access_level: 'ro',
            });
            await acceptAllInvitations(sharedAgent);

            const response = await sharedAgent.get(
                `/api/uploads/tasks/${attachment.stored_filename}`
            );

            expect(response.status).toBe(200);
        });

        it('should reject an authenticated user with no access to the task (GHSA-49fc-pf7x-cj8x)', async () => {
            const otherUser = await createTestUser({
                email: `uploads-other_${Date.now()}@test.com`,
            });
            const otherAgent = request.agent(app);
            await otherAgent
                .post('/api/login')
                .send({ email: otherUser.email, password: 'password123' });

            const response = await otherAgent.get(
                `/api/uploads/tasks/${attachment.stored_filename}`
            );

            expect(response.status).toBe(403);
        });

        it('should reject a request for a filename with no matching attachment record', async () => {
            const response = await ownerAgent.get(
                '/api/uploads/tasks/does-not-exist.pdf'
            );

            expect(response.status).toBe(403);
        });
    });

    describe('Content-Disposition (GHSA-43p8-ch4p-gqg4)', () => {
        const taskUploadDir = path.join(uploadsDir, 'tasks');

        afterEach(async () => {
            await fs.rm(taskUploadDir, { recursive: true, force: true });
        });

        const createAttachment = async (
            storedFilename,
            mimeType,
            content = 'file content'
        ) => {
            await fs.mkdir(taskUploadDir, { recursive: true });
            await fs.writeFile(
                path.join(taskUploadDir, storedFilename),
                content
            );

            return TaskAttachment.create({
                task_id: task.id,
                user_id: owner.id,
                original_filename: storedFilename,
                stored_filename: storedFilename,
                file_size: content.length,
                mime_type: mimeType,
                file_path: `tasks/${storedFilename}`,
            });
        };

        it.each([
            [
                'docx-test.docx',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
            ['txt-test.txt', 'text/plain'],
            ['csv-test.csv', 'text/csv'],
            ['zip-test.zip', 'application/zip'],
            [
                'xlsx-test.xlsx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
        ])(
            'should force Content-Disposition: attachment for %s',
            async (storedFilename, mimeType) => {
                const attachment = await createAttachment(
                    storedFilename,
                    mimeType
                );

                const response = await ownerAgent.get(
                    `/api/uploads/tasks/${attachment.stored_filename}`
                );

                expect(response.status).toBe(200);
                expect(response.headers['content-disposition']).toBe(
                    'attachment'
                );
            }
        );

        it('should not force Content-Disposition for a pdf attachment', async () => {
            const attachment = await createAttachment(
                'pdf-test.pdf',
                'application/pdf'
            );

            const response = await ownerAgent.get(
                `/api/uploads/tasks/${attachment.stored_filename}`
            );

            expect(response.status).toBe(200);
            expect(response.headers['content-disposition']).toBeUndefined();
        });

        it('should not force Content-Disposition for an image attachment', async () => {
            const attachment = await createAttachment(
                'png-test.png',
                'image/png'
            );

            const response = await ownerAgent.get(
                `/api/uploads/tasks/${attachment.stored_filename}`
            );

            expect(response.status).toBe(200);
            expect(response.headers['content-disposition']).toBeUndefined();
        });

        it('should force Content-Disposition: attachment for a legacy .svg file that predates the allow-list fix', async () => {
            // SVG uploads are blocked at upload time (GHSA-x24w-9w59-wqhq),
            // but a file uploaded before that fix could still be sitting on
            // disk with its original .svg extension and DB record. This
            // simulates that: the fix must hold regardless of what the DB
            // mime_type says, since it's derived from the extension on disk.
            const attachment = await createAttachment(
                'legacy-test.svg',
                'image/svg+xml',
                '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>'
            );

            const response = await ownerAgent.get(
                `/api/uploads/tasks/${attachment.stored_filename}`
            );

            expect(response.status).toBe(200);
            expect(response.headers['content-disposition']).toBe('attachment');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });
    });

    describe('project images', () => {
        const projectUploadDir = path.join(uploadsDir, 'projects');

        beforeEach(async () => {
            await fs.mkdir(projectUploadDir, { recursive: true });
            await fs.writeFile(
                path.join(projectUploadDir, 'project-static-test.png'),
                'private banner content'
            );

            await Project.create({
                name: 'Project with a private banner',
                user_id: owner.id,
                image_url: '/api/uploads/projects/project-static-test.png',
            });
        });

        afterEach(async () => {
            await fs.rm(projectUploadDir, { recursive: true, force: true });
        });

        it('should allow the owner to fetch their project image', async () => {
            const response = await ownerAgent.get(
                '/api/uploads/projects/project-static-test.png'
            );

            expect(response.status).toBe(200);
        });

        it('should reject a user with no access to the project', async () => {
            const otherUser = await createTestUser({
                email: `uploads-other-proj_${Date.now()}@test.com`,
            });
            const otherAgent = request.agent(app);
            await otherAgent
                .post('/api/login')
                .send({ email: otherUser.email, password: 'password123' });

            const response = await otherAgent.get(
                '/api/uploads/projects/project-static-test.png'
            );

            expect(response.status).toBe(403);
        });
    });

    describe('avatars', () => {
        const avatarUploadDir = path.join(uploadsDir, 'avatars');

        beforeEach(async () => {
            await fs.mkdir(avatarUploadDir, { recursive: true });
            await fs.writeFile(
                path.join(avatarUploadDir, 'avatar-static-test.png'),
                'avatar content'
            );
        });

        afterEach(async () => {
            await fs.rm(avatarUploadDir, { recursive: true, force: true });
        });

        const avatarOwnerWithFile = async () => {
            await owner.update({
                avatar_image: '/uploads/avatars/avatar-static-test.png',
            });
        };

        it('should allow the owner to fetch their own avatar', async () => {
            await avatarOwnerWithFile();

            const response = await ownerAgent.get(
                '/api/uploads/avatars/avatar-static-test.png'
            );

            expect(response.status).toBe(200);
        });

        it('should allow a collaborator to fetch the avatar', async () => {
            await avatarOwnerWithFile();
            const collaborator = await createTestUser({
                email: `uploads-collab-avatar_${Date.now()}@test.com`,
            });
            const collabAgent = request.agent(app);
            await collabAgent
                .post('/api/login')
                .send({ email: collaborator.email, password: 'password123' });

            const project = await Project.create({
                name: 'Avatar project',
                user_id: owner.id,
            });
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: collaborator.email,
                access_level: 'ro',
            });
            await acceptAllInvitations(collabAgent);

            const response = await collabAgent.get(
                '/api/uploads/avatars/avatar-static-test.png'
            );

            expect(response.status).toBe(200);
        });

        it('should reject a user who shares nothing with the avatar owner', async () => {
            await avatarOwnerWithFile();
            const otherUser = await createTestUser({
                email: `uploads-other-avatar_${Date.now()}@test.com`,
            });
            const otherAgent = request.agent(app);
            await otherAgent
                .post('/api/login')
                .send({ email: otherUser.email, password: 'password123' });

            const response = await otherAgent.get(
                '/api/uploads/avatars/avatar-static-test.png'
            );

            expect(response.status).toBe(403);
        });
    });

    describe('unrecognized categories', () => {
        it('should deny by default for a category with no permission mapping', async () => {
            const response = await ownerAgent.get(
                '/api/uploads/something-unexpected/file.txt'
            );

            expect(response.status).toBe(403);
        });
    });
});
