const request = require('supertest');
const app = require('../../app');
const path = require('path');
const fs = require('fs').promises;
const {
    InboxItem,
    InboxItemAttachment,
    Task,
    TaskAttachment,
} = require('../../models');
const { getConfig } = require('../../config/config');
const { createTestUser } = require('../helpers/testUtils');

describe('Inbox item attachments', () => {
    const testFilesDir = path.join(__dirname, '../test-files-inbox');
    const uploadPath = getConfig().uploadPath;
    let user, agent, item;

    const login = async (email) => {
        const loggedIn = request.agent(app);
        await loggedIn
            .post('/api/login')
            .send({ email, password: 'password123' });
        return loggedIn;
    };

    const upload = (itemUid, filename = 'photo.png', as = agent) =>
        as
            .post(`/api/inbox/${itemUid}/attachments`)
            .attach('file', path.join(testFilesDir, filename));

    beforeAll(async () => {
        await fs.mkdir(testFilesDir, { recursive: true });
        await fs.writeFile(path.join(testFilesDir, 'photo.png'), 'PNG bytes');
        await fs.writeFile(path.join(testFilesDir, 'doc.pdf'), 'PDF bytes');
    });

    afterAll(async () => {
        await fs.rm(testFilesDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        user = await createTestUser({
            email: `inbox-attach_${Date.now()}@test.com`,
        });
        agent = await login(user.email);
        item = await InboxItem.create({
            content: 'Receipt from the plumber',
            title: 'Receipt from the plumber',
            source: 'web',
            user_id: user.id,
        });
    });

    describe('POST /api/inbox/:uid/attachments', () => {
        it('requires authentication', async () => {
            const res = await request(app)
                .post(`/api/inbox/${item.uid}/attachments`)
                .attach('file', path.join(testFilesDir, 'photo.png'));
            expect(res.status).toBe(401);
        });

        it('stores the file under uploads/inbox', async () => {
            const res = await upload(item.uid);

            expect(res.status).toBe(201);
            expect(res.body.original_filename).toBe('photo.png');
            expect(res.body.file_url).toMatch(/^\/api\/uploads\/inbox\//);

            const row = await InboxItemAttachment.findOne({
                where: { uid: res.body.uid },
            });
            expect(row.inbox_item_id).toBe(item.id);
            await expect(
                fs.access(path.join(uploadPath, row.file_path))
            ).resolves.toBeUndefined();
        });

        it('rejects a request without a file', async () => {
            const res = await agent.post(`/api/inbox/${item.uid}/attachments`);
            expect(res.status).toBe(400);
        });

        it("refuses another user's item and writes no file", async () => {
            const other = await createTestUser({
                email: `inbox-attach-other_${Date.now()}@test.com`,
            });
            const otherAgent = await login(other.email);
            const before = await fs
                .readdir(path.join(uploadPath, 'inbox'))
                .catch(() => []);

            const res = await upload(item.uid, 'photo.png', otherAgent);

            expect(res.status).toBe(404);
            const after = await fs
                .readdir(path.join(uploadPath, 'inbox'))
                .catch(() => []);
            expect(after.length).toBe(before.length);
        });

        it('allows at most 20 files per item', async () => {
            for (let i = 0; i < 20; i++) {
                await InboxItemAttachment.create({
                    inbox_item_id: item.id,
                    user_id: user.id,
                    original_filename: `f${i}.png`,
                    stored_filename: `inbox-limit-${i}.png`,
                    file_size: 1,
                    mime_type: 'image/png',
                    file_path: `inbox/inbox-limit-${i}.png`,
                });
            }

            const res = await upload(item.uid);

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Maximum 20/);
        });
    });

    describe('listing', () => {
        it('includes attachments on the item list and the item', async () => {
            await upload(item.uid);

            const list = await agent.get('/api/inbox');
            const listed = list.body.find((i) => i.uid === item.uid);
            expect(listed.attachments).toHaveLength(1);
            expect(listed.attachments[0].original_filename).toBe('photo.png');

            const paged = await agent.get('/api/inbox?limit=20&offset=0');
            expect(paged.body.items[0].attachments).toHaveLength(1);

            const one = await agent.get(`/api/inbox/${item.uid}`);
            expect(one.body.attachments).toHaveLength(1);
        });

        it('lists an item without files with an empty array', async () => {
            const res = await agent.get(`/api/inbox/${item.uid}/attachments`);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('serving files', () => {
        it('serves the file to its owner only', async () => {
            const { body } = await upload(item.uid);

            const own = await agent.get(body.file_url);
            expect(own.status).toBe(200);

            const other = await createTestUser({
                email: `inbox-attach-reader_${Date.now()}@test.com`,
            });
            const otherAgent = await login(other.email);
            const theirs = await otherAgent.get(body.file_url);
            expect(theirs.status).toBe(403);
        });

        it('downloads under the original filename', async () => {
            const { body } = await upload(item.uid, 'doc.pdf');

            const res = await agent.get(
                `/api/inbox/${item.uid}/attachments/${body.uid}/download`
            );

            expect(res.status).toBe(200);
            expect(res.headers['content-disposition']).toContain('doc.pdf');
        });
    });

    describe('removing', () => {
        it('deletes one attachment and its file', async () => {
            const { body } = await upload(item.uid);
            const row = await InboxItemAttachment.findOne({
                where: { uid: body.uid },
            });

            const res = await agent.delete(
                `/api/inbox/${item.uid}/attachments/${body.uid}`
            );

            expect(res.status).toBe(200);
            expect(
                await InboxItemAttachment.count({ where: { uid: body.uid } })
            ).toBe(0);
            await expect(
                fs.access(path.join(uploadPath, row.file_path))
            ).rejects.toThrow();
        });

        it('deletes the files when the item is deleted', async () => {
            const { body } = await upload(item.uid);
            const row = await InboxItemAttachment.findOne({
                where: { uid: body.uid },
            });

            await agent.delete(`/api/inbox/${item.uid}`);

            expect(
                await InboxItemAttachment.count({
                    where: { inbox_item_id: item.id },
                })
            ).toBe(0);
            await expect(
                fs.access(path.join(uploadPath, row.file_path))
            ).rejects.toThrow();
        });
    });

    describe('PATCH /api/inbox/:uid/process with task_uid', () => {
        it('moves the files onto the task', async () => {
            const { body } = await upload(item.uid);
            const task = await Task.create({
                name: 'Pay the plumber',
                user_id: user.id,
            });

            const res = await agent
                .patch(`/api/inbox/${item.uid}/process`)
                .send({ task_uid: task.uid });

            expect(res.status).toBe(200);
            expect(
                await InboxItemAttachment.count({
                    where: { inbox_item_id: item.id },
                })
            ).toBe(0);
            const moved = await TaskAttachment.findOne({
                where: { task_id: task.id },
            });
            expect(moved.original_filename).toBe('photo.png');
            expect(moved.file_path).toBe(`tasks/${body.stored_filename}`);
            await expect(
                fs.access(path.join(uploadPath, moved.file_path))
            ).resolves.toBeUndefined();

            const served = await agent.get(
                `/api/uploads/tasks/${moved.stored_filename}`
            );
            expect(served.status).toBe(200);
        });

        it('refuses a task the user cannot edit and leaves the item as it was', async () => {
            await upload(item.uid);
            const other = await createTestUser({
                email: `inbox-attach-task-owner_${Date.now()}@test.com`,
            });
            const theirTask = await Task.create({
                name: 'Not yours',
                user_id: other.id,
            });

            const res = await agent
                .patch(`/api/inbox/${item.uid}/process`)
                .send({ task_uid: theirTask.uid });

            expect(res.status).toBe(403);
            await item.reload();
            expect(item.status).toBe('added');
            expect(
                await InboxItemAttachment.count({
                    where: { inbox_item_id: item.id },
                })
            ).toBe(1);
        });

        it('still processes an item without a task uid', async () => {
            await upload(item.uid);

            const res = await agent.patch(`/api/inbox/${item.uid}/process`);

            expect(res.status).toBe(200);
            await item.reload();
            expect(item.status).toBe('processed');
        });
    });
});
