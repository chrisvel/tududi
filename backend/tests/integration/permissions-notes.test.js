const request = require('supertest');
const app = require('../../app');
const { Note, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { uid } = require('../../utils/uid');

describe('Notes Permissions', () => {
    let user, otherUser, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `user_${Date.now()}@example.com`,
        });
        otherUser = await createTestUser({
            email: `other_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it("GET /api/note/:id should return 403 for other user's note", async () => {
        const otherNote = await Note.create({
            title: 'Other Note',
            user_id: otherUser.id,
        });

        const res = await agent.get(`/api/note/${otherNote.uid}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("GET /api/note/:uid/backlinks should return 403 for other user's note", async () => {
        const otherNote = await Note.create({
            title: 'Other Note',
            user_id: otherUser.id,
        });
        await Note.create({
            title: 'Mentions it',
            content: 'See [[Other Note]] for details',
            user_id: user.id,
        });

        const res = await agent.get(`/api/note/${otherNote.uid}/backlinks`);
        expect(res.status).toBe(403);
    });

    it('GET /api/note/:uid/backlinks should return 404 for a note that does not exist', async () => {
        const res = await agent.get(`/api/note/${uid()}/backlinks`);
        expect(res.status).toBe(404);
    });

    it('GET /api/note/:uid/backlinks should still work for the owner', async () => {
        const myNote = await Note.create({
            title: 'Target',
            user_id: user.id,
        });
        await Note.create({
            title: 'Linker',
            content: 'Points at [[Target]]',
            user_id: user.id,
        });

        const res = await agent.get(`/api/note/${myNote.uid}/backlinks`);
        expect(res.status).toBe(200);
    });

    it("POST /api/note should return 403 when assigning to other user's project", async () => {
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });

        const res = await agent
            .post('/api/note')
            .send({ title: 'My Note', project_id: otherProject.id });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });

    it("PATCH /api/note/:id should return 403 when reassigning to other user's project", async () => {
        const myNote = await Note.create({
            title: 'My Note',
            user_id: user.id,
        });
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });

        const res = await agent
            .patch(`/api/note/${myNote.uid}`)
            .send({ project_id: otherProject.id });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });
});
