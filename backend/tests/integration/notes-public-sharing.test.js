const request = require('supertest');
const app = require('../../app');
const { Note, Project, Permission } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { uid } = require('../../utils/uid');

async function signIn(email) {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password: 'password123' });
    return agent;
}

describe('Public note sharing', () => {
    let owner, other, ownerAgent, note;

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({ email: `owner_${stamp}@example.com` });
        other = await createTestUser({ email: `other_${stamp}@example.com` });
        ownerAgent = await signIn(owner.email);
        note = await Note.create({
            title: 'Trip plan',
            content: '# Lisbon\n\n- book flights',
            color: '#ffcc00',
            user_id: owner.id,
        });
    });

    describe('owner controls', () => {
        it('starts private', async () => {
            const res = await ownerAgent.get(
                `/api/note/${note.uid}/public-share`
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                enabled: false,
                token: null,
                shared_at: null,
            });
        });

        it('enables sharing and returns a link token', async () => {
            const res = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            expect(res.status).toBe(200);
            expect(res.body.enabled).toBe(true);
            expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
            expect(res.body.shared_at).toBeTruthy();
        });

        it('keeps the same link when sharing is enabled twice', async () => {
            const first = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            const second = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            expect(second.body.token).toBe(first.body.token);
        });

        it('reports the current state to the owner', async () => {
            const enabled = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            const res = await ownerAgent.get(
                `/api/note/${note.uid}/public-share`
            );
            expect(res.body.enabled).toBe(true);
            expect(res.body.token).toBe(enabled.body.token);
        });

        it('does not change the note updated time', async () => {
            const before = (await Note.findByPk(note.id)).updated_at;
            await ownerAgent.post(`/api/note/${note.uid}/public-share`);
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            const after = (await Note.findByPk(note.id)).updated_at;
            expect(after.getTime()).toBe(before.getTime());
        });

        it('disables sharing and clears the token', async () => {
            await ownerAgent.post(`/api/note/${note.uid}/public-share`);
            const res = await ownerAgent.delete(
                `/api/note/${note.uid}/public-share`
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                enabled: false,
                token: null,
                shared_at: null,
            });
            const stored = await Note.findByPk(note.id);
            expect(stored.public_token).toBeNull();
        });

        it('issues a different link after sharing is turned back on', async () => {
            const first = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            const second = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            expect(second.body.token).not.toBe(first.body.token);
        });

        it('returns 404 for a note that does not exist', async () => {
            const res = await ownerAgent.post(
                `/api/note/${uid()}/public-share`
            );
            expect(res.status).toBe(404);
        });

        it('requires authentication', async () => {
            const res = await request(app).post(
                `/api/note/${note.uid}/public-share`
            );
            expect(res.status).toBe(401);
        });
    });

    describe('who may share', () => {
        it('rejects a user with no access to the note', async () => {
            const agent = await signIn(other.email);
            const res = await agent.post(`/api/note/${note.uid}/public-share`);
            expect(res.status).toBe(403);
            expect((await Note.findByPk(note.id)).public_token).toBeNull();
        });

        it('rejects a collaborator with write access who is not the owner', async () => {
            const project = await Project.create({
                name: 'Shared',
                user_id: owner.id,
            });
            await note.update({ project_id: project.id });
            await Permission.create({
                user_id: other.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
                status: 'accepted',
            });
            const agent = await signIn(other.email);

            const read = await agent.get(`/api/note/${note.uid}`);
            expect(read.status).toBe(200);

            const share = await agent.post(
                `/api/note/${note.uid}/public-share`
            );
            expect(share.status).toBe(403);
            const stop = await agent.delete(
                `/api/note/${note.uid}/public-share`
            );
            expect(stop.status).toBe(403);
        });
    });

    describe('the token stays out of note payloads', () => {
        let token;

        beforeEach(async () => {
            const res = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            token = res.body.token;
        });

        it('is not in the note list', async () => {
            const res = await ownerAgent.get('/api/notes');
            const listed = res.body.find((n) => n.uid === note.uid);
            expect(listed.is_public).toBe(true);
            expect(JSON.stringify(res.body)).not.toContain(token);
        });

        it('is not in a single note', async () => {
            const res = await ownerAgent.get(`/api/note/${note.uid}`);
            expect(res.body.is_public).toBe(true);
            expect(JSON.stringify(res.body)).not.toContain(token);
        });

        it('is not in the response of an update', async () => {
            const res = await ownerAgent
                .patch(`/api/note/${note.uid}`)
                .send({ title: 'Renamed' });
            expect(res.status).toBe(200);
            expect(JSON.stringify(res.body)).not.toContain(token);
        });

        it('reports is_public false once sharing is off', async () => {
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            const res = await ownerAgent.get(`/api/note/${note.uid}`);
            expect(res.body.is_public).toBe(false);
        });
    });

    describe('GET /api/public/notes/:token', () => {
        let token;

        beforeEach(async () => {
            const res = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            token = res.body.token;
        });

        it('serves the note without a session', async () => {
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                title: 'Trip plan',
                content: '# Lisbon\n\n- book flights',
                color: '#ffcc00',
                updated_at: expect.any(String),
            });
        });

        it('exposes nothing about the owner or the note ids', async () => {
            const res = await request(app).get(`/api/public/notes/${token}`);
            const body = JSON.stringify(res.body);
            expect(body).not.toContain(owner.email);
            expect(body).not.toContain(note.uid);
            expect(Object.keys(res.body).sort()).toEqual([
                'color',
                'content',
                'title',
                'updated_at',
            ]);
        });

        it('keeps the response out of caches, indexes and Referer headers', async () => {
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.headers['cache-control']).toBe('no-store');
            expect(res.headers['x-robots-tag']).toContain('noindex');
            expect(res.headers['referrer-policy']).toBe('no-referrer');
        });

        it('shows the latest content, not a snapshot', async () => {
            await ownerAgent
                .patch(`/api/note/${note.uid}`)
                .send({ content: 'Updated body' });
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.body.content).toBe('Updated body');
        });

        it('stops working as soon as sharing is disabled', async () => {
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.status).toBe(404);
        });

        it('stays dead after sharing is turned back on', async () => {
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            await ownerAgent.post(`/api/note/${note.uid}/public-share`);
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.status).toBe(404);
        });

        it('stops working when the note is deleted', async () => {
            await ownerAgent.delete(`/api/note/${note.uid}`);
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.status).toBe(404);
        });

        it('answers an unknown and a malformed token the same way', async () => {
            const unknown = await request(app).get(
                `/api/public/notes/${'a'.repeat(43)}`
            );
            const malformed = await request(app).get(
                '/api/public/notes/not-a-token'
            );
            expect(unknown.status).toBe(404);
            expect(malformed.status).toBe(404);
            expect(malformed.body).toEqual(unknown.body);
        });

        it('does not treat the note uid as a token', async () => {
            const res = await request(app).get(`/api/public/notes/${note.uid}`);
            expect(res.status).toBe(404);
        });
    });

    it('never serves a note that was not shared', async () => {
        const res = await request(app).get(
            `/api/public/notes/${'b'.repeat(43)}`
        );
        expect(res.status).toBe(404);
    });
});
