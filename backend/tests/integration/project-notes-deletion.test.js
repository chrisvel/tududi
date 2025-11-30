const request = require('supertest');
const app = require('../../app');
const { Project, Task, Note } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Project Notes and Tasks Deletion', () => {
    let user;
    let agent;
    let project;
    let task;
    let note;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });

        // Create test project
        project = await Project.create({
            name: 'Test Project',
            user_id: user.id,
        });

        // Create test task associated with project
        task = await Task.create({
            name: 'Test Task',
            user_id: user.id,
            project_id: project.id,
            status: 0,
        });

        // Create test note associated with project
        note = await Note.create({
            title: 'Test Note',
            content: 'Test content',
            user_id: user.id,
            project_id: project.id,
        });
    });

    describe('Issue #392: Clearing project from task or note', () => {
        it('should remove task from project when project_id is cleared', async () => {
            // Verify task is initially associated with project
            let projectData = await Project.findOne({
                where: { id: project.id },
                include: [{ model: Task }],
            });
            expect(projectData.Tasks).toHaveLength(1);
            expect(projectData.Tasks[0].id).toBe(task.id);

            // Clear project from task by setting project_id to null
            const updateResponse = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ project_id: null });

            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.project_id).toBeNull();

            // Fetch project again and verify task is no longer associated
            projectData = await Project.findOne({
                where: { id: project.id },
                include: [{ model: Task }],
            });
            expect(projectData.Tasks).toHaveLength(0);

            // Verify task still exists but without project
            const taskData = await Task.findOne({ where: { id: task.id } });
            expect(taskData).not.toBeNull();
            expect(taskData.project_id).toBeNull();
        });

        it('should remove note from project when project_uid is cleared', async () => {
            // Verify note is initially associated with project
            let projectData = await Project.findOne({
                where: { id: project.id },
                include: [{ model: Note }],
            });
            expect(projectData.Notes).toHaveLength(1);
            expect(projectData.Notes[0].id).toBe(note.id);

            // Clear project from note by setting project_uid to empty string
            const updateResponse = await agent
                .patch(`/api/note/${note.uid}`)
                .send({ project_uid: '' });

            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.project_id).toBeNull();

            // Fetch project again and verify note is no longer associated
            projectData = await Project.findOne({
                where: { id: project.id },
                include: [{ model: Note }],
            });
            expect(projectData.Notes).toHaveLength(0);

            // Verify note still exists but without project
            const noteData = await Note.findOne({ where: { id: note.id } });
            expect(noteData).not.toBeNull();
            expect(noteData.project_id).toBeNull();
        });

        it('should remove task from project when project_id is set to empty string', async () => {
            // Clear project from task by setting project_id to empty string
            const updateResponse = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ project_id: '' });

            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.project_id).toBeNull();

            // Fetch project again and verify task is no longer associated
            const projectData = await Project.findOne({
                where: { id: project.id },
                include: [{ model: Task }],
            });
            expect(projectData.Tasks).toHaveLength(0);
        });
    });
});
