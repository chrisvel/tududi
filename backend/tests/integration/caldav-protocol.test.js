const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Task, CalDAVCalendar } = require('../../models');
const bcrypt = require('bcrypt');
const xml2js = require('xml2js');
const { propfind, report } = require('../helpers/caldav-test-utils');

describe('CalDAV Protocol - Phase 3', () => {
    let testUser;
    let testCalendar;
    let authHeader;
    let testTask;

    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        testUser = await User.create({
            email: 'caldav@test.com',
            password_digest: hashedPassword,
            verified: true,
        });

        testCalendar = await CalDAVCalendar.create({
            uid: 'test-calendar-uid',
            user_id: testUser.id,
            name: 'Test Calendar',
            description: 'Calendar for testing',
            enabled: true,
        });

        authHeader =
            'Basic ' +
            Buffer.from('caldav@test.com:password123').toString('base64');
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('Discovery', () => {
        test('GET /.well-known/caldav should redirect to /caldav/', async () => {
            const response = await request(app)
                .get('/.well-known/caldav')
                .expect(301);

            expect(response.headers.location).toContain('/caldav/');
        });
    });

    describe('Authentication', () => {
        // eslint-disable-next-line jest/expect-expect
        test('should reject requests without authentication', async () => {
            await request(app)
                .get('/caldav/caldav@test.com/tasks/')
                .expect(401);
        });

        // eslint-disable-next-line jest/expect-expect
        test('should reject requests with invalid credentials', async () => {
            const badAuth =
                'Basic ' +
                Buffer.from('caldav@test.com:wrongpass').toString('base64');

            await request(app)
                .get('/caldav/caldav@test.com/tasks/')
                .set('Authorization', badAuth)
                .expect(401);
        });

        // eslint-disable-next-line jest/expect-expect
        test('should accept requests with valid HTTP Basic Auth', async () => {
            await request(app)
                .get('/caldav/caldav@test.com/tasks/')
                .set('Authorization', authHeader)
                .expect(207);
        });

        // eslint-disable-next-line jest/expect-expect
        test('should reject access to other users calendars', async () => {
            const otherUser = await User.create({
                email: 'other@test.com',
                password_digest: await bcrypt.hash('password', 10),
                verified: true,
            });

            await request(app)
                .get(`/caldav/${otherUser.email}/tasks/`)
                .set('Authorization', authHeader)
                .expect(403);
        });
    });

    describe('OPTIONS', () => {
        test('should return DAV capabilities', async () => {
            const response = await request(app)
                .options('/caldav/caldav@test.com/tasks/')
                .set('Authorization', authHeader)
                .expect(204);

            expect(response.headers.dav).toContain('calendar-access');
            expect(response.headers.allow).toContain('PROPFIND');
            expect(response.headers.allow).toContain('REPORT');
            expect(response.headers.allow).toContain('GET');
            expect(response.headers.allow).toContain('PUT');
            expect(response.headers.allow).toContain('DELETE');
        });
    });

    describe('PROPFIND', () => {
        beforeEach(async () => {
            testTask = await Task.create({
                uid: 'test-task-1',
                user_id: testUser.id,
                name: 'Test Task',
                status: 0,
                priority: 1,
            });
        });

        afterEach(async () => {
            await Task.destroy({ where: { user_id: testUser.id } });
        });

        test('PROPFIND on calendar collection (depth 0) should return calendar properties', async () => {
            const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <C:getctag/>
  </D:prop>
</D:propfind>`;

            const response = await propfind(
                app,
                '/caldav/caldav@test.com/tasks/'
            )
                .set('Authorization', authHeader)
                .set('Depth', '0')
                .set('Content-Type', 'application/xml')
                .send(propfindXml)
                .expect(207);

            expect(response.text).toContain('Tududi Tasks');
            expect(response.text).toContain('getctag');
            expect(response.text).toContain('resourcetype');
        });

        test('PROPFIND on calendar collection (depth 1) should return tasks', async () => {
            const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getetag/>
  </D:prop>
</D:propfind>`;

            const response = await propfind(
                app,
                '/caldav/caldav@test.com/tasks/'
            )
                .set('Authorization', authHeader)
                .set('Depth', '1')
                .set('Content-Type', 'application/xml')
                .send(propfindXml)
                .expect(207);

            expect(response.text).toContain('test-task-1.ics');
            expect(response.text).toContain('Test Task');
        });

        test('PROPFIND on individual task should return task properties', async () => {
            const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <D:getcontenttype/>
    <D:getlastmodified/>
  </D:prop>
</D:propfind>`;

            const response = await propfind(
                app,
                '/caldav/caldav@test.com/tasks/test-task-1.ics'
            )
                .set('Authorization', authHeader)
                .set('Depth', '0')
                .set('Content-Type', 'application/xml')
                .send(propfindXml)
                .expect(207);

            expect(response.text).toContain('getetag');
            expect(response.text).toContain('getcontenttype');
            expect(response.text).toContain('getlastmodified');
        });
    });

    describe('REPORT (calendar-query)', () => {
        beforeEach(async () => {
            await Task.create({
                uid: 'report-task-1',
                user_id: testUser.id,
                name: 'Report Test Task',
                status: 0,
                priority: 1,
                due_date: new Date('2026-06-15T10:00:00Z'),
            });
        });

        afterEach(async () => {
            await Task.destroy({ where: { user_id: testUser.id } });
        });

        test('REPORT should filter tasks by time range', async () => {
            const reportXml = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VTODO">
      <C:time-range start="20260601T000000Z" end="20260630T235959Z"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

            const response = await report(app, '/caldav/caldav@test.com/tasks/')
                .set('Authorization', authHeader)
                .set('Content-Type', 'application/xml')
                .send(reportXml)
                .expect(207);

            expect(response.text).toContain('report-task-1.ics');
            expect(response.text).toContain('BEGIN:VCALENDAR');
            expect(response.text).toContain('BEGIN:VTODO');
        });

        test('REPORT should return only requested properties', async () => {
            const reportXml = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VTODO"/>
  </C:filter>
</C:calendar-query>`;

            const response = await report(app, '/caldav/caldav@test.com/tasks/')
                .set('Authorization', authHeader)
                .set('Content-Type', 'application/xml')
                .send(reportXml)
                .expect(207);

            expect(response.text).toContain('getetag');
            expect(response.text).not.toContain('BEGIN:VCALENDAR');
        });
    });

    describe('GET Task', () => {
        beforeEach(async () => {
            testTask = await Task.create({
                uid: 'get-task-1',
                user_id: testUser.id,
                name: 'Get Task Test',
                status: 0,
                priority: 1,
            });
        });

        afterEach(async () => {
            await Task.destroy({ where: { user_id: testUser.id } });
        });

        test('GET should return VTODO for existing task', async () => {
            const response = await request(app)
                .get('/caldav/caldav@test.com/tasks/get-task-1.ics')
                .set('Authorization', authHeader)
                .expect(200);

            expect(response.text).toContain('BEGIN:VCALENDAR');
            expect(response.text).toContain('BEGIN:VTODO');
            expect(response.text).toContain('UID:get-task-1');
            expect(response.text).toContain('SUMMARY:Get Task Test');
            expect(response.text).toContain('END:VTODO');
            expect(response.text).toContain('END:VCALENDAR');
            expect(response.headers.etag).toBeDefined();
        });

        // eslint-disable-next-line jest/expect-expect
        test('GET should return 404 for non-existent task', async () => {
            await request(app)
                .get('/caldav/caldav@test.com/tasks/non-existent.ics')
                .set('Authorization', authHeader)
                .expect(404);
        });

        // eslint-disable-next-line jest/expect-expect
        test('GET should support If-None-Match (304 Not Modified)', async () => {
            const firstResponse = await request(app)
                .get('/caldav/caldav@test.com/tasks/get-task-1.ics')
                .set('Authorization', authHeader)
                .expect(200);

            const etag = firstResponse.headers.etag;

            await request(app)
                .get('/caldav/caldav@test.com/tasks/get-task-1.ics')
                .set('Authorization', authHeader)
                .set('If-None-Match', etag)
                .expect(304);
        });
    });

    describe('PUT Task', () => {
        afterEach(async () => {
            await Task.destroy({ where: { user_id: testUser.id } });
        });

        test('PUT should create new task from VTODO', async () => {
            const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tududi//CalDAV//EN
BEGIN:VTODO
UID:put-task-new
SUMMARY:New Task via PUT
STATUS:NEEDS-ACTION
PRIORITY:5
END:VTODO
END:VCALENDAR`;

            const response = await request(app)
                .put('/caldav/caldav@test.com/tasks/put-task-new.ics')
                .set('Authorization', authHeader)
                .set('Content-Type', 'text/calendar')
                .send(vtodo)
                .expect(201);

            expect(response.headers.etag).toBeDefined();

            const created = await Task.findOne({
                where: { uid: 'put-task-new' },
            });
            expect(created).toBeDefined();
            expect(created.name).toBe('New Task via PUT');
            expect(created.status).toBe(0);
        });

        test('PUT should update existing task', async () => {
            const existing = await Task.create({
                uid: 'put-task-update',
                user_id: testUser.id,
                name: 'Original Name',
                status: 0,
            });

            const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tududi//CalDAV//EN
BEGIN:VTODO
UID:put-task-update
SUMMARY:Updated Name
STATUS:COMPLETED
END:VTODO
END:VCALENDAR`;

            await request(app)
                .put('/caldav/caldav@test.com/tasks/put-task-update.ics')
                .set('Authorization', authHeader)
                .set('Content-Type', 'text/calendar')
                .send(vtodo)
                .expect(204);

            await existing.reload();
            expect(existing.name).toBe('Updated Name');
            expect(existing.status).toBe(2);
        });

        // eslint-disable-next-line jest/expect-expect
        test('PUT should respect If-Match precondition', async () => {
            const existing = await Task.create({
                uid: 'put-task-match',
                user_id: testUser.id,
                name: 'Test Task',
                status: 0,
            });

            const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:put-task-match
SUMMARY:Updated
END:VTODO
END:VCALENDAR`;

            await request(app)
                .put('/caldav/caldav@test.com/tasks/put-task-match.ics')
                .set('Authorization', authHeader)
                .set('If-Match', '"wrong-etag"')
                .set('Content-Type', 'text/calendar')
                .send(vtodo)
                .expect(412);
        });

        // eslint-disable-next-line jest/expect-expect
        test('PUT should reject invalid VTODO', async () => {
            const invalidVtodo = 'This is not valid iCalendar data';

            await request(app)
                .put('/caldav/caldav@test.com/tasks/invalid.ics')
                .set('Authorization', authHeader)
                .set('Content-Type', 'text/calendar')
                .send(invalidVtodo)
                .expect(400);
        });
    });

    describe('DELETE Task', () => {
        beforeEach(async () => {
            testTask = await Task.create({
                uid: 'delete-task-1',
                user_id: testUser.id,
                name: 'Task to Delete',
                status: 0,
            });
        });

        afterEach(async () => {
            await Task.destroy({ where: { user_id: testUser.id } });
        });

        test('DELETE should remove existing task', async () => {
            await request(app)
                .delete('/caldav/caldav@test.com/tasks/delete-task-1.ics')
                .set('Authorization', authHeader)
                .expect(204);

            const deleted = await Task.findOne({
                where: { uid: 'delete-task-1' },
            });
            expect(deleted).toBeNull();
        });

        // eslint-disable-next-line jest/expect-expect
        test('DELETE should return 404 for non-existent task', async () => {
            await request(app)
                .delete('/caldav/caldav@test.com/tasks/non-existent.ics')
                .set('Authorization', authHeader)
                .expect(404);
        });

        test('DELETE should respect If-Match precondition', async () => {
            await request(app)
                .delete('/caldav/caldav@test.com/tasks/delete-task-1.ics')
                .set('Authorization', authHeader)
                .set('If-Match', '"wrong-etag"')
                .expect(412);

            const stillExists = await Task.findOne({
                where: { uid: 'delete-task-1' },
            });
            expect(stillExists).toBeDefined();
        });
    });

    describe('ETag and CTag', () => {
        beforeEach(async () => {
            testTask = await Task.create({
                uid: 'etag-task',
                user_id: testUser.id,
                name: 'ETag Test',
                status: 0,
            });
        });

        afterEach(async () => {
            await Task.destroy({ where: { user_id: testUser.id } });
        });

        test('ETag should change when task is updated', async () => {
            const response1 = await request(app)
                .get('/caldav/caldav@test.com/tasks/etag-task.ics')
                .set('Authorization', authHeader)
                .expect(200);

            const etag1 = response1.headers.etag;

            await testTask.update({ name: 'Updated Name' });

            const response2 = await request(app)
                .get('/caldav/caldav@test.com/tasks/etag-task.ics')
                .set('Authorization', authHeader)
                .expect(200);

            const etag2 = response2.headers.etag;

            expect(etag1).not.toBe(etag2);
        });

        test('CTag should be present in calendar PROPFIND', async () => {
            const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:getctag/>
  </D:prop>
</D:propfind>`;

            const response = await propfind(
                app,
                '/caldav/caldav@test.com/tasks/'
            )
                .set('Authorization', authHeader)
                .set('Depth', '0')
                .set('Content-Type', 'application/xml')
                .send(propfindXml)
                .expect(207);

            expect(response.text).toContain('getctag');
            expect(response.text).toContain('ctag-');
        });
    });
});
