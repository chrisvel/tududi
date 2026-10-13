const request = require('supertest');
const app = require('../../app');
const { Task, CalDAVCalendar } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { propfind } = require('../helpers/caldav-test-utils');

// RFC 4791 5.3.2: the URL of a calendar object resource is arbitrary and need
// not match the UID inside it. tasks.org, DAVx5 and iOS Reminders all name the
// file themselves, so the UID a client sends and the resource name it uploads
// under are two different things. Reading the URL as the identity made the
// server hand the client back a VTODO whose UID had changed; clients answer
// that by re-uploading, which left a row behind each time - the duplicate,
// undeletable "ghost tasks" of #1371.
describe('CalDAV resource name is not the task identity (#1371)', () => {
    const CLIENT_UID = '3f7c2b1a-8e5d-4c9f-9a2b-1d6e4f0a7c33';
    const RESOURCE_NAME = '1754712345678-9021';
    const OTHER_UID = 'b7d1e0c4-2a55-4f31-8f60-9c2d7b1e5a10';

    let user;
    let otherUser;
    let agent;
    let authHeader;

    const base = () => `/caldav/${encodeURIComponent(user.email)}/tasks`;

    const vtodo = (uid, summary = 'Buy milk') =>
        [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//tasks.org//android//EN',
            'BEGIN:VTODO',
            `UID:${uid}`,
            `SUMMARY:${summary}`,
            'STATUS:NEEDS-ACTION',
            'END:VTODO',
            'END:VCALENDAR',
            '',
        ].join('\r\n');

    const put = (name, body = vtodo(CLIENT_UID)) =>
        request(app)
            .put(`${base()}/${name}.ics`)
            .set('Authorization', authHeader)
            .set('Content-Type', 'text/calendar')
            .send(body);

    const get = (name) =>
        request(app)
            .get(`${base()}/${name}.ics`)
            .set('Authorization', authHeader);

    const UIDLESS = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VTODO',
        'SUMMARY:No uid at all',
        'STATUS:NEEDS-ACTION',
        'END:VTODO',
        'END:VCALENDAR',
        '',
    ].join('\r\n');

    beforeEach(async () => {
        user = await createTestUser({
            email: `uid-identity-${Date.now()}@example.com`,
        });

        await CalDAVCalendar.create({
            uid: `cal-${Date.now()}`,
            user_id: user.id,
            name: 'Tasks',
            enabled: true,
        });

        authHeader =
            'Basic ' +
            Buffer.from(`${user.email}:password123`).toString('base64');

        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    afterEach(async () => {
        await Task.destroy({ where: { user_id: user.id } });
        if (otherUser) {
            await Task.destroy({ where: { user_id: otherUser.id } });
            otherUser = null;
        }
    });

    describe('uploading under a name the client chose', () => {
        test('keeps the UID from the object and the name from the URL', async () => {
            const response = await put(RESOURCE_NAME);
            expect(response.status).toBe(201);

            const task = await Task.findOne({ where: { user_id: user.id } });
            expect(task.uid).toBe(CLIENT_UID);
            expect(task.caldav_resource_name).toBe(RESOURCE_NAME);
        });

        test('serves the client its own UID at its own URL', async () => {
            await put(RESOURCE_NAME);

            const response = await get(RESOURCE_NAME);
            expect(response.status).toBe(200);
            expect(response.text).toContain(`UID:${CLIENT_UID}`);
        });

        test('also answers at the uid-derived URL', async () => {
            await put(RESOURCE_NAME);

            const response = await get(CLIENT_UID);
            expect(response.status).toBe(200);
            expect(response.text).toContain(`UID:${CLIENT_UID}`);
        });

        test('answers a PROPFIND on the URL it was handed', async () => {
            await put(RESOURCE_NAME);

            // The collection advertises this href, so a client may PROPFIND it
            // directly (DAVx5 refreshes one resource that way). Resolving the
            // URL by uid only made that 404 on a URL the client was just given.
            const response = await propfind(
                app,
                `${base()}/${RESOURCE_NAME}.ics`
            )
                .set('Authorization', authHeader)
                .set('Depth', '0')
                .send(
                    '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>'
                );

            expect(response.status).toBe(207);
            expect(response.text).toContain(`${RESOURCE_NAME}.ics`);
            expect(response.text).toContain('getetag');
        });

        test('lists the resource under the name the client chose', async () => {
            await put(RESOURCE_NAME);

            const response = await propfind(app, `${base()}/`)
                .set('Authorization', authHeader)
                .set('Depth', '1')
                .send(
                    '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>'
                );

            expect(response.status).toBe(207);
            expect(response.text).toContain(`${RESOURCE_NAME}.ics`);
            expect(response.text).not.toContain(`${CLIENT_UID}.ics`);
        });

        test('is the task the app lists, and the app can delete it', async () => {
            await put(RESOURCE_NAME);

            const task = await Task.findOne({ where: { user_id: user.id } });
            const response = await agent.delete(`/api/task/${task.uid}`);

            expect(response.status).toBe(200);
            expect(await Task.count({ where: { user_id: user.id } })).toBe(0);
        });
    });

    describe('a UID belongs to one resource', () => {
        test('a second upload of the same UID under a new name is refused', async () => {
            await put(RESOURCE_NAME);

            const second = await put('1754712345999-1234');

            expect(second.status).toBe(409);
            expect(second.text).toContain('no-uid-conflict');
            expect(second.text).toContain(`${RESOURCE_NAME}.ics`);
            expect(await Task.count({ where: { user_id: user.id } })).toBe(1);
        });

        test('changing the UID of the resource at a URL is refused', async () => {
            await put(RESOURCE_NAME);

            const response = await put(RESOURCE_NAME, vtodo(OTHER_UID));

            expect(response.status).toBe(409);
            expect(response.text).toContain('no-uid-conflict');
            expect(await Task.count({ where: { user_id: user.id } })).toBe(1);
        });

        test('an edit that keeps the UID still updates the task', async () => {
            await put(RESOURCE_NAME);

            const response = await put(
                RESOURCE_NAME,
                vtodo(CLIENT_UID, 'Buy oat milk')
            );

            expect(response.status).toBe(204);

            const task = await Task.findOne({ where: { user_id: user.id } });
            expect(task.name).toBe('Buy oat milk');
            expect(task.uid).toBe(CLIENT_UID);
        });
    });

    describe('deleting', () => {
        test('by the name the client used removes the task', async () => {
            await put(RESOURCE_NAME);

            const response = await request(app)
                .delete(`${base()}/${RESOURCE_NAME}.ics`)
                .set('Authorization', authHeader);

            expect(response.status).toBe(204);
            expect(await Task.count({ where: { user_id: user.id } })).toBe(0);
        });
    });

    describe('tasks Tududi created', () => {
        test('answer at their uid, as they always did', async () => {
            await Task.create({
                uid: 'tududi-created-task',
                user_id: user.id,
                name: 'Made in the app',
                status: 0,
            });

            const response = await get('tududi-created-task');

            expect(response.status).toBe(200);
            expect(response.text).toContain('UID:tududi-created-task');
        });

        test('are uploaded with a name when the object has no UID', async () => {
            const response = await put('uidless-resource', UIDLESS);
            expect(response.status).toBe(201);

            const task = await Task.findOne({ where: { user_id: user.id } });
            expect(task.uid).toBe('uidless-resource');
        });

        test('keep the uid a resource already had when a re-upload has none', async () => {
            await put(RESOURCE_NAME);

            const response = await put(RESOURCE_NAME, UIDLESS);

            expect(response.status).toBe(204);

            const task = await Task.findOne({ where: { user_id: user.id } });
            // The URL is not the identity: an upload that arrives without a
            // UID must not rewrite the one this resource was created with.
            expect(task.uid).toBe(CLIENT_UID);
            expect(task.caldav_resource_name).toBe(RESOURCE_NAME);
            expect(await Task.count({ where: { user_id: user.id } })).toBe(1);

            const served = await get(RESOURCE_NAME);
            expect(served.status).toBe(200);
            expect(served.text).toContain(`UID:${CLIENT_UID}`);
        });
    });

    describe('a resource name is only unique to the client that chose it', () => {
        test('another user\'s task of the same name does not shadow this one', async () => {
            otherUser = await createTestUser({
                email: `uid-identity-other-${Date.now()}@example.com`,
            });
            // Same string, both columns: the other user's task has it as its
            // uid, ours as its resource name. Both are legal, and the URL we
            // ask about is ours.
            await Task.create({
                uid: 'clashing-uid-and-name',
                user_id: otherUser.id,
                name: 'Their task',
                status: 0,
            });

            const created = await put('clashing-uid-and-name');
            expect(created.status).toBe(201);

            const response = await get('clashing-uid-and-name');
            expect(response.status).toBe(200);
            expect(response.text).toContain(`UID:${CLIENT_UID}`);
            expect(response.text).not.toContain('Their task');

            // And the other user's task is untouched.
            const theirs = await Task.findOne({
                where: { user_id: otherUser.id },
            });
            expect(theirs.uid).toBe('clashing-uid-and-name');
            expect(theirs.name).toBe('Their task');
        });
    });
});
