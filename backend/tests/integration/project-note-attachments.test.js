const request = require('supertest');
const app = require('../../app');
const path = require('path');
const fs = require('fs').promises;
const {
    InboxItem,
    InboxItemAttachment,
    Note,
    NoteAttachment,
    Project,
    ProjectAttachment,
} = require('../../models');
const { getConfig } = require('../../config/config');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

describe('Project and note attachments', () => {
    const testFilesDir = path.join(__dirname, '../test-files-project-note');
    const uploadPath = getConfig().uploadPath;
    let owner, agent, project, note;

    const login = async (email) => {
        const loggedIn = request.agent(app);
        await loggedIn
            .post('/api/login')
            .send({ email, password: 'password123' });
        return loggedIn;
    };

    const fileExists = (relative) =>
        fs
            .access(path.join(uploadPath, relative))
            .then(() => true)
            .catch(() => false);

    beforeAll(async () => {
        await fs.mkdir(testFilesDir, { recursive: true });
        await fs.writeFile(path.join(testFilesDir, 'plan.png'), 'PNG bytes');
        await fs.writeFile(path.join(testFilesDir, 'brief.pdf'), 'PDF bytes');
    });

    afterAll(async () => {
        await fs.rm(testFilesDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        owner = await createTestUser({
            email: `pn-attach-owner_${Date.now()}@test.com`,
        });
        agent = await login(owner.email);
        project = await Project.create({ name: 'Garden', user_id: owner.id });
        note = await Note.create({
            title: 'Plants',
            content: 'Tomatoes',
            user_id: owner.id,
        });
    });

    describe('projects', () => {
        const upload = (as = agent, file = 'brief.pdf') =>
            as
                .post(`/api/project/${project.uid}/attachments`)
                .attach('file', path.join(testFilesDir, file));

        it('uploads, lists, downloads and deletes a file', async () => {
            const created = await upload();
            expect(created.status).toBe(201);
            expect(created.body.file_url).toMatch(
                /^\/api\/uploads\/project-files\//
            );

            const list = await agent.get(
                `/api/project/${project.uid}/attachments`
            );
            expect(list.body.map((a) => a.original_filename)).toEqual([
                'brief.pdf',
            ]);

            const download = await agent.get(
                `/api/project/${project.uid}/attachments/${created.body.uid}/download`
            );
            expect(download.status).toBe(200);
            expect(download.headers['content-disposition']).toContain(
                'brief.pdf'
            );

            const removed = await agent.delete(
                `/api/project/${project.uid}/attachments/${created.body.uid}`
            );
            expect(removed.status).toBe(200);
            expect(
                await fileExists(
                    `project-files/${created.body.stored_filename}`
                )
            ).toBe(false);
        });

        it('lets a read-only collaborator see but not add files', async () => {
            const { body } = await upload();
            const reader = await createTestUser({
                email: `pn-attach-reader_${Date.now()}@test.com`,
            });
            const readerAgent = await login(reader.email);
            await agent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: reader.email,
                access_level: 'ro',
            });
            await acceptAllInvitations(readerAgent);

            const list = await readerAgent.get(
                `/api/project/${project.uid}/attachments`
            );
            expect(list.status).toBe(200);
            const file = await readerAgent.get(body.file_url);
            expect(file.status).toBe(200);

            const denied = await upload(readerAgent);
            expect(denied.status).toBe(403);
        });

        it("refuses a stranger and serves them none of the project's files", async () => {
            const { body } = await upload();
            const stranger = await createTestUser({
                email: `pn-attach-stranger_${Date.now()}@test.com`,
            });
            const strangerAgent = await login(stranger.email);

            expect(
                (
                    await strangerAgent.get(
                        `/api/project/${project.uid}/attachments`
                    )
                ).status
            ).toBe(403);
            expect((await strangerAgent.get(body.file_url)).status).toBe(403);
        });

        it('deletes the files with the project', async () => {
            const { body } = await upload();

            await agent.delete(`/api/project/${project.uid}`);

            expect(
                await ProjectAttachment.count({ where: { uid: body.uid } })
            ).toBe(0);
            expect(
                await fileExists(`project-files/${body.stored_filename}`)
            ).toBe(false);
        });
    });

    describe('notes', () => {
        it('uploads a file to a note and serves it to the owner only', async () => {
            const created = await agent
                .post(`/api/note/${note.uid}/attachments`)
                .attach('file', path.join(testFilesDir, 'plan.png'));

            expect(created.status).toBe(201);
            expect(created.body.file_url).toMatch(
                /^\/api\/uploads\/note-files\//
            );
            expect((await agent.get(created.body.file_url)).status).toBe(200);

            const stranger = await createTestUser({
                email: `pn-attach-note-stranger_${Date.now()}@test.com`,
            });
            const strangerAgent = await login(stranger.email);
            expect(
                (await strangerAgent.get(created.body.file_url)).status
            ).toBe(403);
        });

        it('deletes the files with the note', async () => {
            const { body } = await agent
                .post(`/api/note/${note.uid}/attachments`)
                .attach('file', path.join(testFilesDir, 'plan.png'));

            await agent.delete(`/api/note/${note.uid}`);

            expect(
                await NoteAttachment.count({ where: { uid: body.uid } })
            ).toBe(0);
            expect(await fileExists(`note-files/${body.stored_filename}`)).toBe(
                false
            );
        });
    });

    describe('inbox items becoming a project or a note', () => {
        let item;

        const uploadToItem = (file) =>
            agent
                .post(`/api/inbox/${item.uid}/attachments`)
                .attach('file', path.join(testFilesDir, file));

        beforeEach(async () => {
            item = await InboxItem.create({
                content: 'Garden ideas',
                title: 'Garden ideas',
                source: 'web',
                user_id: owner.id,
            });
        });

        it('moves the files onto the project', async () => {
            const { body } = await uploadToItem('brief.pdf');

            const res = await agent
                .patch(`/api/inbox/${item.uid}/process`)
                .send({ project_uid: project.uid });

            expect(res.status).toBe(200);
            expect(
                await InboxItemAttachment.count({
                    where: { inbox_item_id: item.id },
                })
            ).toBe(0);
            const moved = await ProjectAttachment.findOne({
                where: { project_id: project.id },
            });
            expect(moved.original_filename).toBe('brief.pdf');
            expect(
                await fileExists(`project-files/${body.stored_filename}`)
            ).toBe(true);
        });

        it('moves the files onto the note and places them in its text', async () => {
            await uploadToItem('plan.png');
            await uploadToItem('brief.pdf');

            const res = await agent
                .patch(`/api/inbox/${item.uid}/process`)
                .send({ note_uid: note.uid });

            expect(res.status).toBe(200);
            const files = await NoteAttachment.findAll({
                where: { note_id: note.id },
                order: [['created_at', 'ASC']],
            });
            expect(files).toHaveLength(2);
            await note.reload();
            const image = files.find((f) => f.mime_type === 'image/png');
            const pdf = files.find((f) => f.mime_type === 'application/pdf');
            expect(note.content).toContain('Tomatoes');
            expect(note.content).toContain(
                `![plan.png](/api/uploads/note-files/${image.stored_filename})`
            );
            expect(note.content).toContain(
                `[brief.pdf](/api/note/${note.uid}/attachments/${pdf.uid}/download)`
            );
        });
    });
});
