const request = require('supertest');
const app = require('../../app');
const path = require('path');
const fs = require('fs').promises;
const { Task, TaskAttachment, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Attachments Routes', () => {
    let user, agent, task;
    const testFilesDir = path.join(__dirname, '../test-files');

    beforeAll(async () => {
        // Create test files directory
        await fs.mkdir(testFilesDir, { recursive: true });

        // Create a test PDF file
        await fs.writeFile(
            path.join(testFilesDir, 'test.pdf'),
            'PDF test content'
        );

        // Create a test PNG file
        await fs.writeFile(
            path.join(testFilesDir, 'test.png'),
            'PNG test content'
        );

        // Create a test TXT file
        await fs.writeFile(
            path.join(testFilesDir, 'test.txt'),
            'Text test content'
        );

        // Create an invalid file type
        await fs.writeFile(
            path.join(testFilesDir, 'test.exe'),
            'EXE test content'
        );
    });

    afterAll(async () => {
        // Clean up test files
        try {
            await fs.rm(testFilesDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore errors
        }
    });

    beforeEach(async () => {
        user = await createTestUser({
            email: 'attachment-routes-test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'attachment-routes-test@example.com',
            password: 'password123',
        });

        // Create a test task
        task = await Task.create({
            name: 'Test Task with Attachments',
            user_id: user.id,
        });
    });

    describe('POST /api/upload/task-attachment', () => {
        describe('Authentication', () => {
            it('should require authentication', async () => {
                const response = await request(app)
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid)
                    .attach('file', path.join(testFilesDir, 'test.pdf'));

                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            });
        });

        describe('Valid Upload', () => {
            it('should upload a PDF file', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid)
                    .attach('file', path.join(testFilesDir, 'test.pdf'));

                expect(response.status).toBe(201);
                expect(response.body.uid).toBeDefined();
                expect(response.body.original_filename).toBe('test.pdf');
                expect(response.body.mime_type).toBe('application/pdf');
                expect(response.body.file_url).toBeDefined();
                expect(response.body.file_url).toContain('/api/uploads/tasks/');
            });

            it('should upload a PNG file', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid)
                    .attach('file', path.join(testFilesDir, 'test.png'));

                expect(response.status).toBe(201);
                expect(response.body.original_filename).toBe('test.png');
                expect(response.body.mime_type).toBe('image/png');
            });

            it('should upload a text file', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid)
                    .attach('file', path.join(testFilesDir, 'test.txt'));

                expect(response.status).toBe(201);
                expect(response.body.original_filename).toBe('test.txt');
                expect(response.body.mime_type).toBe('text/plain');
            });

            it('should create database record', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid)
                    .attach('file', path.join(testFilesDir, 'test.pdf'));

                expect(response.status).toBe(201);

                const attachment = await TaskAttachment.findOne({
                    where: { uid: response.body.uid },
                });

                expect(attachment).not.toBeNull();
                expect(attachment.task_id).toBe(task.id);
                expect(attachment.user_id).toBe(user.id);
                expect(attachment.original_filename).toBe('test.pdf');
            });
        });

        describe('Validation', () => {
            it('should require taskUid', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .attach('file', path.join(testFilesDir, 'test.pdf'));

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Task UID is required');
            });

            it('should require file', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('No file uploaded');
            });

            it('should reject non-existent task', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', 'non-existent-uid')
                    .attach('file', path.join(testFilesDir, 'test.pdf'));

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Task not found');
            });

            it('should reject invalid file type', async () => {
                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid)
                    .attach('file', path.join(testFilesDir, 'test.exe'));

                expect(response.status).toBe(500);
                expect(response.body.error).toBeDefined();
            });

            it('should enforce 20 attachment limit', async () => {
                // Create 20 attachments
                for (let i = 0; i < 20; i++) {
                    await TaskAttachment.create({
                        task_id: task.id,
                        user_id: user.id,
                        original_filename: `file${i}.pdf`,
                        stored_filename: `task-${i}.pdf`,
                        file_size: 1024,
                        mime_type: 'application/pdf',
                        file_path: `tasks/task-${i}.pdf`,
                    });
                }

                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', task.uid)
                    .attach('file', path.join(testFilesDir, 'test.pdf'));

                expect(response.status).toBe(400);
                expect(response.body.error).toBe(
                    'Maximum 20 attachments allowed per task'
                );
            });
        });

        describe('Authorization', () => {
            it('should reject upload to another users task', async () => {
                // Create another user and task
                const otherUser = await createTestUser({
                    email: 'other-user@example.com',
                });

                const otherTask = await Task.create({
                    name: 'Other Users Task',
                    user_id: otherUser.id,
                });

                const response = await agent
                    .post('/api/upload/task-attachment')
                    .field('taskUid', otherTask.uid)
                    .attach('file', path.join(testFilesDir, 'test.pdf'));

                expect(response.status).toBe(403);
                expect(response.body.error).toBe(
                    'Not authorized to upload to this task'
                );
            });
        });
    });

    describe('GET /api/tasks/:taskUid/attachments', () => {
        let attachment1, attachment2;

        beforeEach(async () => {
            // Create test attachments
            attachment1 = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'document.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            });

            attachment2 = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'image.png',
                stored_filename: 'task-67890.png',
                file_size: 2048,
                mime_type: 'image/png',
                file_path: 'tasks/task-67890.png',
            });
        });

        describe('Authentication', () => {
            it('should require authentication', async () => {
                const response = await request(app).get(
                    `/api/tasks/${task.uid}/attachments`
                );

                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            });
        });

        describe('Successful Retrieval', () => {
            it('should get all attachments for a task', async () => {
                const response = await agent.get(
                    `/api/tasks/${task.uid}/attachments`
                );

                expect(response.status).toBe(200);
                expect(response.body.length).toBe(2);
                expect(response.body[0].original_filename).toBe('document.pdf');
                expect(response.body[1].original_filename).toBe('image.png');
            });

            it('should include file URLs', async () => {
                const response = await agent.get(
                    `/api/tasks/${task.uid}/attachments`
                );

                expect(response.status).toBe(200);
                expect(response.body[0].file_url).toBeDefined();
                expect(response.body[0].file_url).toContain(
                    '/api/uploads/tasks/'
                );
            });

            it('should return empty array for task with no attachments', async () => {
                const newTask = await Task.create({
                    name: 'Task without attachments',
                    user_id: user.id,
                });

                const response = await agent.get(
                    `/api/tasks/${newTask.uid}/attachments`
                );

                expect(response.status).toBe(200);
                expect(response.body).toEqual([]);
            });

            it('should order attachments by creation date', async () => {
                const response = await agent.get(
                    `/api/tasks/${task.uid}/attachments`
                );

                expect(response.status).toBe(200);
                const dates = response.body.map((a) => new Date(a.created_at));
                for (let i = 1; i < dates.length; i++) {
                    expect(dates[i] >= dates[i - 1]).toBe(true);
                }
            });
        });

        describe('Validation', () => {
            it('should return 404 for non-existent task', async () => {
                const response = await agent.get(
                    '/api/tasks/non-existent-uid/attachments'
                );

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Task not found');
            });
        });

        describe('Authorization', () => {
            it('should reject access to another users task', async () => {
                const otherUser = await createTestUser({
                    email: 'other-user-2@example.com',
                });

                const otherTask = await Task.create({
                    name: 'Other Users Task',
                    user_id: otherUser.id,
                });

                const response = await agent.get(
                    `/api/tasks/${otherTask.uid}/attachments`
                );

                expect(response.status).toBe(403);
                expect(response.body.error).toBe(
                    'Not authorized to view this task'
                );
            });
        });
    });

    describe('DELETE /api/tasks/:taskUid/attachments/:attachmentUid', () => {
        let attachment;
        const uploadPath = path.join(__dirname, '../../uploads/tasks');

        beforeEach(async () => {
            // Create upload directory
            await fs.mkdir(uploadPath, { recursive: true });

            // Create a test file
            const testFilePath = path.join(uploadPath, 'task-delete-test.pdf');
            await fs.writeFile(testFilePath, 'test content');

            // Create attachment record
            attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'to-delete.pdf',
                stored_filename: 'task-delete-test.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-delete-test.pdf',
            });
        });

        afterEach(async () => {
            // Clean up upload directory
            try {
                await fs.rm(uploadPath, { recursive: true, force: true });
            } catch (error) {
                // Ignore errors
            }
        });

        describe('Authentication', () => {
            it('should require authentication', async () => {
                const response = await request(app).delete(
                    `/api/tasks/${task.uid}/attachments/${attachment.uid}`
                );

                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            });
        });

        describe('Successful Deletion', () => {
            it('should delete attachment', async () => {
                const response = await agent.delete(
                    `/api/tasks/${task.uid}/attachments/${attachment.uid}`
                );

                expect(response.status).toBe(200);
                expect(response.body.message).toBe(
                    'Attachment deleted successfully'
                );

                // Verify database record is deleted
                const deletedAttachment = await TaskAttachment.findOne({
                    where: { uid: attachment.uid },
                });
                expect(deletedAttachment).toBeNull();
            });

            it('should delete file from disk', async () => {
                const filePath = path.join(uploadPath, 'task-delete-test.pdf');

                // Verify file exists before deletion
                await expect(fs.access(filePath)).resolves.toBeUndefined();

                await agent.delete(
                    `/api/tasks/${task.uid}/attachments/${attachment.uid}`
                );

                // Verify file is deleted
                await expect(fs.access(filePath)).rejects.toThrow();
            });
        });

        describe('Validation', () => {
            it('should return 404 for non-existent task', async () => {
                const response = await agent.delete(
                    `/api/tasks/non-existent-uid/attachments/${attachment.uid}`
                );

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Task not found');
            });

            it('should return 404 for non-existent attachment', async () => {
                const response = await agent.delete(
                    `/api/tasks/${task.uid}/attachments/non-existent-uid`
                );

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Attachment not found');
            });

            it('should return 404 for attachment from different task', async () => {
                const otherTask = await Task.create({
                    name: 'Other Task',
                    user_id: user.id,
                });

                const response = await agent.delete(
                    `/api/tasks/${otherTask.uid}/attachments/${attachment.uid}`
                );

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Attachment not found');
            });
        });

        describe('Authorization', () => {
            it('should reject deletion from another users task', async () => {
                const otherUser = await createTestUser({
                    email: 'other-user-3@example.com',
                });

                const otherTask = await Task.create({
                    name: 'Other Users Task',
                    user_id: otherUser.id,
                });

                const otherAttachment = await TaskAttachment.create({
                    task_id: otherTask.id,
                    user_id: otherUser.id,
                    original_filename: 'other.pdf',
                    stored_filename: 'task-other.pdf',
                    file_size: 1024,
                    mime_type: 'application/pdf',
                    file_path: 'tasks/task-other.pdf',
                });

                const response = await agent.delete(
                    `/api/tasks/${otherTask.uid}/attachments/${otherAttachment.uid}`
                );

                expect(response.status).toBe(403);
                expect(response.body.error).toBe(
                    'Not authorized to modify this task'
                );
            });
        });
    });

    describe('GET /api/attachments/:attachmentUid/download', () => {
        let attachment;
        const uploadPath = path.join(__dirname, '../../uploads/tasks');

        beforeEach(async () => {
            // Create upload directory
            await fs.mkdir(uploadPath, { recursive: true });

            // Create a test file
            const testFilePath = path.join(
                uploadPath,
                'task-download-test.pdf'
            );
            await fs.writeFile(testFilePath, 'test download content');

            // Create attachment record
            attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'download.pdf',
                stored_filename: 'task-download-test.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-download-test.pdf',
            });
        });

        afterEach(async () => {
            // Clean up upload directory
            try {
                await fs.rm(uploadPath, { recursive: true, force: true });
            } catch (error) {
                // Ignore errors
            }
        });

        describe('Authentication', () => {
            it('should require authentication', async () => {
                const response = await request(app).get(
                    `/api/attachments/${attachment.uid}/download`
                );

                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            });
        });

        describe('Successful Download', () => {
            it('should download attachment', async () => {
                const response = await agent.get(
                    `/api/attachments/${attachment.uid}/download`
                );

                expect(response.status).toBe(200);
                // The response body should contain the file content
                const body = response.body || response.text;
                expect(body).toBeDefined();
            });

            it('should set correct content-disposition header', async () => {
                const response = await agent.get(
                    `/api/attachments/${attachment.uid}/download`
                );

                expect(response.status).toBe(200);
                expect(response.headers['content-disposition']).toContain(
                    'download.pdf'
                );
            });
        });

        describe('Validation', () => {
            it('should return 404 for non-existent attachment', async () => {
                const response = await agent.get(
                    '/api/attachments/non-existent-uid/download'
                );

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Attachment not found');
            });
        });

        describe('Authorization', () => {
            it('should reject download from another users task', async () => {
                const otherUser = await createTestUser({
                    email: 'other-user-4@example.com',
                });

                const otherTask = await Task.create({
                    name: 'Other Users Task',
                    user_id: otherUser.id,
                });

                const otherAttachment = await TaskAttachment.create({
                    task_id: otherTask.id,
                    user_id: otherUser.id,
                    original_filename: 'other.pdf',
                    stored_filename: 'task-other.pdf',
                    file_size: 1024,
                    mime_type: 'application/pdf',
                    file_path: 'tasks/task-other.pdf',
                });

                const response = await agent.get(
                    `/api/attachments/${otherAttachment.uid}/download`
                );

                expect(response.status).toBe(403);
                expect(response.body.error).toBe(
                    'Not authorized to download this file'
                );
            });
        });
    });
});
