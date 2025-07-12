const request = require('supertest');
const app = require('../../app');
const { Note, User, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Notes Routes', () => {
    let user, project, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        project = await Project.create({
            name: 'Test Project',
            user_id: user.id,
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/note', () => {
        it('should create a new note', async () => {
            const noteData = {
                title: 'Test Note',
                content: 'This is a test note content',
                project_id: project.id,
            };

            const response = await agent.post('/api/note').send(noteData);

            expect(response.status).toBe(201);
            expect(response.body.title).toBe(noteData.title);
            expect(response.body.content).toBe(noteData.content);
            expect(response.body.project_id).toBe(project.id);
            expect(response.body.user_id).toBe(user.id);
        });

        it('should create note without project', async () => {
            const noteData = {
                title: 'Test Note',
                content: 'This is a test note content',
            };

            const response = await agent.post('/api/note').send(noteData);

            expect(response.status).toBe(201);
            expect(response.body.title).toBe(noteData.title);
            expect(response.body.content).toBe(noteData.content);
            expect(response.body.project_id).toBeNull();
            expect(response.body.user_id).toBe(user.id);
        });

        it('should require authentication', async () => {
            const noteData = {
                title: 'Test Note',
                content: 'Test content',
            };

            const response = await request(app)
                .post('/api/note')
                .send(noteData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/notes', () => {
        let note1, note2;

        beforeEach(async () => {
            note1 = await Note.create({
                title: 'Note 1',
                content: 'First note content',
                user_id: user.id,
                project_id: project.id,
            });

            note2 = await Note.create({
                title: 'Note 2',
                content: 'Second note content',
                user_id: user.id,
            });
        });

        it('should get all user notes', async () => {
            const response = await agent.get('/api/notes');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            expect(response.body.map((n) => n.id)).toContain(note1.id);
            expect(response.body.map((n) => n.id)).toContain(note2.id);
        });

        it('should include project information', async () => {
            const response = await agent.get('/api/notes');

            expect(response.status).toBe(200);
            const noteWithProject = response.body.find(
                (n) => n.id === note1.id
            );
            expect(noteWithProject.Project).toBeDefined();
            expect(noteWithProject.Project.name).toBe(project.name);
        });

        it('should return all notes when no filter is applied', async () => {
            const response = await agent.get('/api/notes');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((n) => n.id)).toContain(note1.id);
            expect(response.body.map((n) => n.id)).toContain(note2.id);
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/notes');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/note/:id', () => {
        let note;

        beforeEach(async () => {
            note = await Note.create({
                title: 'Test Note',
                content: 'Test content',
                user_id: user.id,
                project_id: project.id,
            });
        });

        it('should get note by id', async () => {
            const response = await agent.get(`/api/note/${note.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(note.id);
            expect(response.body.title).toBe(note.title);
            expect(response.body.content).toBe(note.content);
        });

        it('should return 404 for non-existent note', async () => {
            const response = await agent.get('/api/note/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Note not found.');
        });

        it("should not allow access to other user's notes", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherNote = await Note.create({
                title: 'Other Note',
                user_id: otherUser.id,
            });

            const response = await agent.get(`/api/note/${otherNote.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Note not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(`/api/note/${note.id}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/note/:id', () => {
        let note;

        beforeEach(async () => {
            note = await Note.create({
                title: 'Test Note',
                content: 'Test content',
                user_id: user.id,
            });
        });

        it('should update note', async () => {
            const updateData = {
                title: 'Updated Note',
                content: 'Updated content',
                project_id: project.id,
            };

            const response = await agent
                .patch(`/api/note/${note.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.title).toBe(updateData.title);
            expect(response.body.content).toBe(updateData.content);
            expect(response.body.project_id).toBe(project.id);
        });

        it('should return 404 for non-existent note', async () => {
            const response = await agent
                .patch('/api/note/999999')
                .send({ title: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Note not found.');
        });

        it("should not allow updating other user's notes", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherNote = await Note.create({
                title: 'Other Note',
                user_id: otherUser.id,
            });

            const response = await agent
                .patch(`/api/note/${otherNote.id}`)
                .send({ title: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Note not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/note/${note.id}`)
                .send({ title: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/note/:id', () => {
        let note;

        beforeEach(async () => {
            note = await Note.create({
                title: 'Test Note',
                user_id: user.id,
            });
        });

        it('should delete note', async () => {
            const response = await agent.delete(`/api/note/${note.id}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Note deleted successfully.');

            // Verify note is deleted
            const deletedNote = await Note.findByPk(note.id);
            expect(deletedNote).toBeNull();
        });

        it('should return 404 for non-existent note', async () => {
            const response = await agent.delete('/api/note/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Note not found.');
        });

        it("should not allow deleting other user's notes", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherNote = await Note.create({
                title: 'Other Note',
                user_id: otherUser.id,
            });

            const response = await agent.delete(`/api/note/${otherNote.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Note not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(`/api/note/${note.id}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
