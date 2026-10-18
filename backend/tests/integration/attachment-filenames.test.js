const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Attachment original filenames', () => {
    let user, agent, task;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'filename-encoding-test@example.com',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'filename-encoding-test@example.com',
            password: 'password123',
        });
        task = await Task.create({
            name: 'Filename encoding task',
            user_id: user.id,
        });
    });

    it('keeps non-ASCII filenames intact on task uploads', async () => {
        const name = '测试文档.pdf';
        const response = await agent
            .post('/api/upload/task-attachment')
            .field('taskUid', task.uid)
            .attach('file', Buffer.from('PDF test content'), {
                filename: name,
                contentType: 'application/pdf',
            });

        expect(response.status).toBe(201);
        expect(response.body.original_filename).toBe(name);
    });

    it('keeps accented and Cyrillic filenames intact', async () => {
        const name = 'Пример café.txt';
        const response = await agent
            .post('/api/upload/task-attachment')
            .field('taskUid', task.uid)
            .attach('file', Buffer.from('text'), {
                filename: name,
                contentType: 'text/plain',
            });

        expect(response.status).toBe(201);
        expect(response.body.original_filename).toBe(name);
    });
});
