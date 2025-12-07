const { TaskAttachment, Task, User } = require('../../../models');

describe('TaskAttachment Model', () => {
    let user, task;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'attachment-test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        task = await Task.create({
            name: 'Test Task',
            user_id: user.id,
        });
    });

    describe('validation', () => {
        it('should create an attachment with valid data', async () => {
            const attachmentData = {
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            };

            const attachment = await TaskAttachment.create(attachmentData);

            expect(attachment.task_id).toBe(task.id);
            expect(attachment.user_id).toBe(user.id);
            expect(attachment.original_filename).toBe('test.pdf');
            expect(attachment.stored_filename).toBe('task-12345.pdf');
            expect(attachment.file_size).toBe(1024);
            expect(attachment.mime_type).toBe('application/pdf');
            expect(attachment.file_path).toBe('tasks/task-12345.pdf');
            expect(attachment.uid).toBeDefined();
        });

        it('should require task_id', async () => {
            const attachmentData = {
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            };

            await expect(
                TaskAttachment.create(attachmentData)
            ).rejects.toThrow();
        });

        it('should require user_id', async () => {
            const attachmentData = {
                task_id: task.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            };

            await expect(
                TaskAttachment.create(attachmentData)
            ).rejects.toThrow();
        });

        it('should require original_filename', async () => {
            const attachmentData = {
                task_id: task.id,
                user_id: user.id,
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            };

            await expect(
                TaskAttachment.create(attachmentData)
            ).rejects.toThrow();
        });

        it('should require stored_filename', async () => {
            const attachmentData = {
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            };

            await expect(
                TaskAttachment.create(attachmentData)
            ).rejects.toThrow();
        });

        it('should require file_size', async () => {
            const attachmentData = {
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            };

            await expect(
                TaskAttachment.create(attachmentData)
            ).rejects.toThrow();
        });

        it('should require mime_type', async () => {
            const attachmentData = {
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                file_path: 'tasks/task-12345.pdf',
            };

            await expect(
                TaskAttachment.create(attachmentData)
            ).rejects.toThrow();
        });

        it('should require file_path', async () => {
            const attachmentData = {
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
            };

            await expect(
                TaskAttachment.create(attachmentData)
            ).rejects.toThrow();
        });

        it('should have unique uid', async () => {
            const attachment1 = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test1.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            });

            const attachment2 = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test2.pdf',
                stored_filename: 'task-67890.pdf',
                file_size: 2048,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-67890.pdf',
            });

            expect(attachment1.uid).not.toBe(attachment2.uid);
        });
    });

    describe('associations', () => {
        it('should belong to a task', async () => {
            const attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            });

            const associatedTask = await attachment.getTask();
            expect(associatedTask.id).toBe(task.id);
            expect(associatedTask.name).toBe('Test Task');
        });

        it('should belong to a user', async () => {
            const attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            });

            const associatedUser = await attachment.getUser();
            expect(associatedUser.id).toBe(user.id);
            expect(associatedUser.email).toBe('attachment-test@example.com');
        });
    });

    describe('file types', () => {
        it('should support PDF files', async () => {
            const attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'document.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            });

            expect(attachment.mime_type).toBe('application/pdf');
        });

        it('should support image files', async () => {
            const attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'screenshot.png',
                stored_filename: 'task-12345.png',
                file_size: 2048,
                mime_type: 'image/png',
                file_path: 'tasks/task-12345.png',
            });

            expect(attachment.mime_type).toBe('image/png');
        });

        it('should support document files', async () => {
            const attachment = await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'report.docx',
                stored_filename: 'task-12345.docx',
                file_size: 3072,
                mime_type:
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                file_path: 'tasks/task-12345.docx',
            });

            expect(attachment.mime_type).toBe(
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
        });
    });

    describe('cascade deletion', () => {
        it('should delete attachments when task is deleted', async () => {
            await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'test.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            });

            const countBefore = await TaskAttachment.count({
                where: { task_id: task.id },
            });
            expect(countBefore).toBe(1);

            await task.destroy();

            const countAfter = await TaskAttachment.count({
                where: { task_id: task.id },
            });
            expect(countAfter).toBe(0);
        });
    });

    describe('multiple attachments', () => {
        it('should allow multiple attachments for the same task', async () => {
            await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'file1.pdf',
                stored_filename: 'task-12345.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                file_path: 'tasks/task-12345.pdf',
            });

            await TaskAttachment.create({
                task_id: task.id,
                user_id: user.id,
                original_filename: 'file2.png',
                stored_filename: 'task-67890.png',
                file_size: 2048,
                mime_type: 'image/png',
                file_path: 'tasks/task-67890.png',
            });

            const attachments = await TaskAttachment.findAll({
                where: { task_id: task.id },
            });

            expect(attachments.length).toBe(2);
        });
    });
});
