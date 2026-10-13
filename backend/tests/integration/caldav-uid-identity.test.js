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
            const noUid = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'BEGIN:VTODO',
                'SUMMARY:No uid at all',
                'STATUS:NEEDS-ACTION',
                'END:VTODO',
                'END:VCALENDAR',
                '',
            ].join('\r\n');

            const response = await put('uidless-resource', noUid);
            expect(response.status).toBe(201);

            const task = await Task.findOne({ where: { user_id: user.id } });
            expect(task.uid).toBe('uidless-resource');
        });
    });
});
