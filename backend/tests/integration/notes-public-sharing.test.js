const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const app = require('../../app');
const { Note, NoteAttachment, Project, Permission } = require('../../models');
const { getConfig } = require('../../config/config');
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
                public_inherit_style: true,
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

        it('disables sharing but keeps the link for later', async () => {
            await ownerAgent.post(`/api/note/${note.uid}/public-share`);
            const res = await ownerAgent.delete(
                `/api/note/${note.uid}/public-share`
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                enabled: false,
                token: null,
                shared_at: null,
                public_inherit_style: true,
            });
            const stored = await Note.findByPk(note.id);
            expect(stored.public_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        });

        it('brings back the same link when sharing is turned back on', async () => {
            const first = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            const second = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            expect(second.body.token).toBe(first.body.token);
        });

        it('reports a note whose sharing is off as not public', async () => {
            await ownerAgent.post(`/api/note/${note.uid}/public-share`);
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            const res = await ownerAgent.get(`/api/note/${note.uid}`);
            expect(res.body.is_public).toBe(false);
        });

        it('replaces the link with a new one on request', async () => {
            const first = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            const rotated = await ownerAgent.post(
                `/api/note/${note.uid}/public-share/rotate`
            );
            expect(rotated.status).toBe(200);
            expect(rotated.body.enabled).toBe(true);
            expect(rotated.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
            expect(rotated.body.token).not.toBe(first.body.token);

            const oldLink = await request(app).get(
                `/api/public/notes/${first.body.token}`
            );
            const newLink = await request(app).get(
                `/api/public/notes/${rotated.body.token}`
            );
            expect(oldLink.status).toBe(404);
            expect(newLink.status).toBe(200);
        });

        it('does not make a new link for a note that is not shared', async () => {
            const res = await ownerAgent.post(
                `/api/note/${note.uid}/public-share/rotate`
            );
            expect(res.status).toBe(400);
        });

        it('lets only the owner make a new link', async () => {
            await ownerAgent.post(`/api/note/${note.uid}/public-share`);
            const otherAgent = await signIn(other.email);
            const res = await otherAgent.post(
                `/api/note/${note.uid}/public-share/rotate`
            );
            expect([403, 404]).toContain(res.status);
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

    describe('inheriting the note styling', () => {
        it('is chosen when sharing is turned on', async () => {
            const res = await ownerAgent
                .post(`/api/note/${note.uid}/public-share`)
                .send({ public_inherit_style: true });
            expect(res.body.public_inherit_style).toBe(true);
        });

        it('can be turned off later', async () => {
            await ownerAgent
                .post(`/api/note/${note.uid}/public-share`)
                .send({ public_inherit_style: true });
            const res = await ownerAgent
                .patch(`/api/note/${note.uid}/public-share`)
                .send({ public_inherit_style: false });
            expect(res.body.public_inherit_style).toBe(false);
        });

        it('rejects a value that is not a boolean', async () => {
            const res = await ownerAgent
                .patch(`/api/note/${note.uid}/public-share`)
                .send({ public_inherit_style: 'yes' });
            expect(res.status).toBe(400);
        });

        it('stays with the owner', async () => {
            const otherAgent = await signIn(other.email);
            const res = await otherAgent
                .patch(`/api/note/${note.uid}/public-share`)
                .send({ public_inherit_style: true });
            expect([403, 404]).toContain(res.status);
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
                background: null,
                updated_at: expect.any(String),
                linked_notes: [],
            });
        });

        it('exposes nothing about the owner or the note ids', async () => {
            const res = await request(app).get(`/api/public/notes/${token}`);
            const body = JSON.stringify(res.body);
            expect(body).not.toContain(owner.email);
            expect(body).not.toContain(note.uid);
            expect(Object.keys(res.body).sort()).toEqual([
                'background',
                'color',
                'content',
                'linked_notes',
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

        it('works again when sharing is turned back on', async () => {
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            await ownerAgent.post(`/api/note/${note.uid}/public-share`);
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.status).toBe(200);
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

        it("shows the note's color and background only when it inherits them", async () => {
            await ownerAgent
                .patch(`/api/note/${note.uid}`)
                .send({ background: 'mural' });
            await ownerAgent
                .patch(`/api/note/${note.uid}/public-share`)
                .send({ public_inherit_style: false });
            const plain = await request(app).get(`/api/public/notes/${token}`);
            expect(plain.body.color).toBeNull();
            expect(plain.body.background).toBeNull();

            await ownerAgent
                .patch(`/api/note/${note.uid}/public-share`)
                .send({ public_inherit_style: true });
            const styled = await request(app).get(`/api/public/notes/${token}`);
            expect(styled.body.color).toBe('#ffcc00');
            expect(styled.body.background).toBe('mural');
        });

        it('lists only linked notes that are public too', async () => {
            const shared = await Note.create({
                title: 'Packing list',
                content: '',
                user_id: owner.id,
            });
            await Note.create({
                title: 'Budget',
                content: '',
                user_id: owner.id,
            });
            const sharedRes = await ownerAgent.post(
                `/api/note/${shared.uid}/public-share`
            );
            await ownerAgent.patch(`/api/note/${note.uid}`).send({
                content: 'See [[packing list]], [[Budget]] and [[Nowhere]].',
            });

            const res = await request(app).get(`/api/public/notes/${token}`);

            expect(res.body.linked_notes).toEqual([
                { title: 'Packing list', token: sharedRes.body.token },
            ]);
        });

        it("never links to another user's public note", async () => {
            const otherAgent = await signIn(other.email);
            const foreign = await Note.create({
                title: 'Packing list',
                content: '',
                user_id: other.id,
            });
            await otherAgent.post(`/api/note/${foreign.uid}/public-share`);
            await ownerAgent
                .patch(`/api/note/${note.uid}`)
                .send({ content: 'See [[Packing list]].' });

            const res = await request(app).get(`/api/public/notes/${token}`);

            expect(res.body.linked_notes).toEqual([]);
        });

        it('does not treat the note uid as a token', async () => {
            const res = await request(app).get(`/api/public/notes/${note.uid}`);
            expect(res.status).toBe(404);
        });
    });

    describe('files attached to a public note', () => {
        const uploadPath = getConfig().uploadPath;
        let token, stored, written;

        const attach = async (owningNote, name, body) => {
            const storedName = `note-${Date.now()}-${uid()}${path.extname(name)}`;
            await fs.mkdir(path.join(uploadPath, 'note-files'), {
                recursive: true,
            });
            await fs.writeFile(
                path.join(uploadPath, 'note-files', storedName),
                body
            );
            written.push(storedName);
            await NoteAttachment.create({
                note_id: owningNote.id,
                user_id: owningNote.user_id,
                original_filename: name,
                stored_filename: storedName,
                file_size: body.length,
                mime_type: 'application/octet-stream',
                file_path: `note-files/${storedName}`,
            });
            return storedName;
        };

        beforeEach(async () => {
            written = [];
            stored = await attach(note, 'board.png', 'PNG bytes');
            await note.update({
                content: `# Lisbon\n\n![The board](/api/uploads/note-files/${stored})`,
            });
            const res = await ownerAgent.post(
                `/api/note/${note.uid}/public-share`
            );
            token = res.body.token;
        });

        afterEach(async () => {
            await Promise.all(
                written.map((name) =>
                    fs.rm(path.join(uploadPath, 'note-files', name), {
                        force: true,
                    })
                )
            );
        });

        it('points the images in the content at the public link', async () => {
            const res = await request(app).get(`/api/public/notes/${token}`);
            expect(res.body.content).toBe(
                `# Lisbon\n\n![The board](/api/public/notes/${token}/files/${stored})`
            );
        });

        it('serves an attached image without a session', async () => {
            const res = await request(app).get(
                `/api/public/notes/${token}/files/${stored}`
            );
            expect(res.status).toBe(200);
            expect(res.body.toString()).toBe('PNG bytes');
            expect(res.headers['cache-control']).toBe('no-store');
            expect(res.headers['referrer-policy']).toBe('no-referrer');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['content-disposition']).toBeUndefined();
        });

        it('downloads a file that is not safe to show inline', async () => {
            const script = await attach(
                note,
                'notes.html',
                '<script></script>'
            );
            const res = await request(app).get(
                `/api/public/notes/${token}/files/${script}`
            );
            expect(res.status).toBe(200);
            expect(res.headers['content-disposition']).toMatch(
                /^attachment; filename="notes.html"/
            );
        });

        it('still refuses the private upload address without a session', async () => {
            const res = await request(app).get(
                `/api/uploads/note-files/${stored}`
            );
            expect(res.status).toBe(401);
        });

        it("never serves another note's file through the link", async () => {
            const privateNote = await Note.create({
                title: 'Private',
                content: '',
                user_id: owner.id,
            });
            const secret = await attach(privateNote, 'secret.png', 'secret');
            const res = await request(app).get(
                `/api/public/notes/${token}/files/${secret}`
            );
            expect(res.status).toBe(404);
        });

        it('stops serving files when sharing is turned off', async () => {
            await ownerAgent.delete(`/api/note/${note.uid}/public-share`);
            const res = await request(app).get(
                `/api/public/notes/${token}/files/${stored}`
            );
            expect(res.status).toBe(404);
        });

        it('refuses a file name that walks out of the folder', async () => {
            const res = await request(app).get(
                `/api/public/notes/${token}/files/..%2F..%2Fpackage.json`
            );
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
