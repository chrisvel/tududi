const { Note, User, Project } = require('../../../models');

describe('Note Model', () => {
    let user, project;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        project = await Project.create({
            name: 'Test Project',
            user_id: user.id,
        });
    });

    describe('validation', () => {
        it('should create a note with valid data', async () => {
            const noteData = {
                title: 'Test Note',
                content: 'This is a test note content',
                user_id: user.id,
                project_id: project.id,
            };

            const note = await Note.create(noteData);

            expect(note.title).toBe(noteData.title);
            expect(note.content).toBe(noteData.content);
            expect(note.user_id).toBe(user.id);
            expect(note.project_id).toBe(project.id);
        });

        it('should require user_id', async () => {
            const noteData = {
                title: 'Test Note',
                content: 'Test content',
            };

            await expect(Note.create(noteData)).rejects.toThrow();
        });

        it('should allow title and content to be null', async () => {
            const noteData = {
                title: null,
                content: null,
                user_id: user.id,
            };

            const note = await Note.create(noteData);
            expect(note.title).toBeNull();
            expect(note.content).toBeNull();
        });

        it('should allow project_id to be null', async () => {
            const noteData = {
                title: 'Test Note',
                content: 'Test content',
                user_id: user.id,
                project_id: null,
            };

            const note = await Note.create(noteData);
            expect(note.project_id).toBeNull();
        });
    });

    describe('associations', () => {
        it('should belong to a user', async () => {
            const note = await Note.create({
                title: 'Test Note',
                user_id: user.id,
            });

            const noteWithUser = await Note.findByPk(note.id, {
                include: [{ model: User }],
            });

            expect(noteWithUser.User).toBeDefined();
            expect(noteWithUser.User.id).toBe(user.id);
            expect(noteWithUser.User.email).toBe(user.email);
        });

        it('should belong to a project', async () => {
            const note = await Note.create({
                title: 'Test Note',
                user_id: user.id,
                project_id: project.id,
            });

            const noteWithProject = await Note.findByPk(note.id, {
                include: [{ model: Project }],
            });

            expect(noteWithProject.Project).toBeDefined();
            expect(noteWithProject.Project.id).toBe(project.id);
            expect(noteWithProject.Project.name).toBe(project.name);
        });
    });
});
