const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Project, Task } = require('../../models');
const bcrypt = require('bcrypt');
const { propfind, report } = require('../helpers/caldav-test-utils');

const ENC = encodeURIComponent;

describe('CalDAV Per-Project Calendars', () => {
    let testUser;
    let testProject;
    let authHeader;

    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        testUser = await User.create({
            email: 'projects-caldav@test.com',
            password_digest: hashedPassword,
            verified: true,
        });

        testProject = await Project.create({
            uid: 'proj-caldav-test-1',
            user_id: testUser.id,
            name: 'Test Project',
        });

        authHeader =
            'Basic ' +
            Buffer.from('projects-caldav@test.com:password123').toString(
                'base64'
            );
    });

    afterAll(async () => {
        await sequelize.close();
    });

    const projectsUrl = () => `/caldav/${ENC(testUser.email)}/projects/`;
    const projectUrl = () =>
        `/caldav/${ENC(testUser.email)}/projects/${ENC(testProject.uid)}/`;
    const inboxUrl = () => `/caldav/${ENC(testUser.email)}/projects/__inbox__/`;

    describe('Flag off (default)', () => {
        beforeEach(() => {
            delete process.env.CALDAV_PROJECTS_AS_CALENDARS;
        });

        // eslint-disable-next-line jest/expect-expect
        test('PROPFIND /projects/ returns 404', async () => {
            await propfind(app, projectsUrl())
                .set('Authorization', authHeader)
                .set('Content-Type', 'application/xml')
                .send('<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>')
                .expect(404);
        });

        // eslint-disable-next-line jest/expect-expect
        test('PROPFIND /projects/:uid/ returns 404', async () => {
            await propfind(app, projectUrl())
                .set('Authorization', authHeader)
                .set('Content-Type', 'application/xml')
                .send('<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>')
                .expect(404);
        });
    });

    describe('Flag on', () => {
        beforeEach(() => {
            process.env.CALDAV_PROJECTS_AS_CALENDARS = 'true';
        });

        afterEach(() => {
            delete process.env.CALDAV_PROJECTS_AS_CALENDARS;
        });

        describe('Calendar home PROPFIND', () => {
            test('depth-0 returns home collection', async () => {
                const response = await propfind(app, projectsUrl())
                    .set('Authorization', authHeader)
                    .set('Depth', '0')
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(207);

                expect(response.text).toContain(projectsUrl());
                expect(response.text).toContain('Tududi Projects');
            });

            test('depth-1 lists one calendar per project plus (No Project)', async () => {
                const response = await propfind(app, projectsUrl())
                    .set('Authorization', authHeader)
                    .set('Depth', '1')
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(207);

                expect(response.text).toContain(ENC(testProject.uid));
                expect(response.text).toContain('Test Project');
                expect(response.text).toContain('__inbox__');
                expect(response.text).toContain('No Project');
            });

            test("depth-1 does not include another user's projects", async () => {
                const otherUser = await User.create({
                    email: 'other-proj-caldav@test.com',
                    password_digest: await bcrypt.hash('password', 10),
                    verified: true,
                });
                await Project.create({
                    uid: 'other-project-caldav-uid',
                    user_id: otherUser.id,
                    name: 'Other User Project',
                });

                const response = await propfind(app, projectsUrl())
                    .set('Authorization', authHeader)
                    .set('Depth', '1')
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(207);

                expect(response.text).not.toContain('other-project-caldav-uid');
                expect(response.text).not.toContain('Other User Project');
            });
        });

        describe('Project calendar PROPFIND', () => {
            test('depth-0 returns calendar collection properties', async () => {
                const response = await propfind(app, projectUrl())
                    .set('Authorization', authHeader)
                    .set('Depth', '0')
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(207);

                expect(response.text).toContain('Test Project');
                expect(response.text).toContain('getctag');
            });

            test('depth-1 returns only tasks in that project', async () => {
                await Task.create({
                    uid: 'proj-task-1',
                    user_id: testUser.id,
                    project_id: testProject.id,
                    name: 'Project Task',
                    status: 0,
                });
                await Task.create({
                    uid: 'no-proj-task-1',
                    user_id: testUser.id,
                    project_id: null,
                    name: 'No Project Task',
                    status: 0,
                });

                const response = await propfind(app, projectUrl())
                    .set('Authorization', authHeader)
                    .set('Depth', '1')
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(207);

                expect(response.text).toContain('proj-task-1.ics');
                expect(response.text).not.toContain('no-proj-task-1.ics');
            });

            test('PROPFIND /projects/__inbox__/ returns (No Project) calendar', async () => {
                const response = await propfind(app, inboxUrl())
                    .set('Authorization', authHeader)
                    .set('Depth', '0')
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(207);

                expect(response.text).toContain('No Project');
                expect(response.text).toContain('getctag');
            });

            test('depth-1 on __inbox__ returns only unassigned tasks', async () => {
                await Task.create({
                    uid: 'proj-task-2',
                    user_id: testUser.id,
                    project_id: testProject.id,
                    name: 'Project Task 2',
                    status: 0,
                });
                await Task.create({
                    uid: 'inbox-task-1',
                    user_id: testUser.id,
                    project_id: null,
                    name: 'Inbox Task',
                    status: 0,
                });

                const response = await propfind(app, inboxUrl())
                    .set('Authorization', authHeader)
                    .set('Depth', '1')
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(207);

                expect(response.text).toContain('inbox-task-1.ics');
                expect(response.text).not.toContain('proj-task-2.ics');
            });

            // eslint-disable-next-line jest/expect-expect
            test('unknown project UID returns 404', async () => {
                await propfind(
                    app,
                    `/caldav/${ENC(testUser.email)}/projects/nonexistent-uid/`
                )
                    .set('Authorization', authHeader)
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(404);
            });
        });

        describe('REPORT', () => {
            const reportXml = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter><C:comp-filter name="VTODO"/></C:filter>
</C:calendar-query>`;

            test("REPORT on project calendar returns only that project's tasks", async () => {
                await Task.create({
                    uid: 'report-proj-task',
                    user_id: testUser.id,
                    project_id: testProject.id,
                    name: 'Report Project Task',
                    status: 0,
                });
                await Task.create({
                    uid: 'report-inbox-task',
                    user_id: testUser.id,
                    project_id: null,
                    name: 'Report Inbox Task',
                    status: 0,
                });

                const response = await report(app, projectUrl())
                    .set('Authorization', authHeader)
                    .set('Content-Type', 'application/xml')
                    .send(reportXml)
                    .expect(207);

                expect(response.text).toContain('report-proj-task.ics');
                expect(response.text).not.toContain('report-inbox-task.ics');
            });

            test('REPORT on __inbox__ returns only unassigned tasks', async () => {
                await Task.create({
                    uid: 'report-proj-task-2',
                    user_id: testUser.id,
                    project_id: testProject.id,
                    name: 'In Project',
                    status: 0,
                });
                await Task.create({
                    uid: 'report-inbox-task-2',
                    user_id: testUser.id,
                    project_id: null,
                    name: 'No Project',
                    status: 0,
                });

                const response = await report(app, inboxUrl())
                    .set('Authorization', authHeader)
                    .set('Content-Type', 'application/xml')
                    .send(reportXml)
                    .expect(207);

                expect(response.text).toContain('report-inbox-task-2.ics');
                expect(response.text).not.toContain('report-proj-task-2.ics');
            });
        });

        describe('PUT into project calendar', () => {
            test('creates task with the correct project_id', async () => {
                const vtodo = [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//Test//EN',
                    'BEGIN:VTODO',
                    'UID:put-proj-task-1',
                    'SUMMARY:New Project Task',
                    'STATUS:NEEDS-ACTION',
                    'END:VTODO',
                    'END:VCALENDAR',
                ].join('\r\n');

                await request(app)
                    .put(
                        `/caldav/${ENC(testUser.email)}/projects/${ENC(testProject.uid)}/put-proj-task-1.ics`
                    )
                    .set('Authorization', authHeader)
                    .set('Content-Type', 'text/calendar')
                    .send(vtodo)
                    .expect(201);

                const created = await Task.findOne({
                    where: { uid: 'put-proj-task-1' },
                });
                expect(created).not.toBeNull();
                expect(created.project_id).toBe(testProject.id);
            });

            test('PUT to __inbox__ creates task with project_id null', async () => {
                const vtodo = [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//Test//EN',
                    'BEGIN:VTODO',
                    'UID:put-inbox-task-1',
                    'SUMMARY:Inbox Task',
                    'STATUS:NEEDS-ACTION',
                    'END:VTODO',
                    'END:VCALENDAR',
                ].join('\r\n');

                await request(app)
                    .put(
                        `/caldav/${ENC(testUser.email)}/projects/__inbox__/put-inbox-task-1.ics`
                    )
                    .set('Authorization', authHeader)
                    .set('Content-Type', 'text/calendar')
                    .send(vtodo)
                    .expect(201);

                const created = await Task.findOne({
                    where: { uid: 'put-inbox-task-1' },
                });
                expect(created).not.toBeNull();
                expect(created.project_id).toBeNull();
            });
        });

        describe('MKCOL', () => {
            // eslint-disable-next-line jest/expect-expect
            test('MKCOL on /projects/ returns 405', async () => {
                await request(app)
                    .mkcol(projectsUrl())
                    .set('Authorization', authHeader)
                    .expect(405);
            });

            // eslint-disable-next-line jest/expect-expect
            test('MKCOL on /projects/:uid/ returns 405', async () => {
                await request(app)
                    .mkcol(projectUrl())
                    .set('Authorization', authHeader)
                    .expect(405);
            });
        });

        describe('Authentication', () => {
            // eslint-disable-next-line jest/expect-expect
            test('unauthenticated PROPFIND /projects/ returns 401', async () => {
                await propfind(app, projectsUrl())
                    .set('Content-Type', 'application/xml')
                    .send(
                        '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
                    )
                    .expect(401);
            });
        });
    });

    describe('handlePutTask project_uid fix', () => {
        beforeEach(() => {
            delete process.env.CALDAV_PROJECTS_AS_CALENDARS;
        });

        test('PUT to /tasks/ does not persist project_uid as an unknown field', async () => {
            const vtodo = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Test//EN',
                'BEGIN:VTODO',
                'UID:put-tasks-proj-uid',
                'SUMMARY:Task With Project UID',
                'STATUS:NEEDS-ACTION',
                `X-TUDUDI-PROJECT-UID:${testProject.uid}`,
                'END:VTODO',
                'END:VCALENDAR',
            ].join('\r\n');

            await request(app)
                .put(
                    `/caldav/${ENC(testUser.email)}/tasks/put-tasks-proj-uid.ics`
                )
                .set('Authorization', authHeader)
                .set('Content-Type', 'text/calendar')
                .send(vtodo)
                .expect(201);

            const created = await Task.findOne({
                where: { uid: 'put-tasks-proj-uid' },
            });
            expect(created).not.toBeNull();
            expect(created.dataValues).not.toHaveProperty('project_uid');
        });
    });
});
