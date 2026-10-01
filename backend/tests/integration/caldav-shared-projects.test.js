const request = require('supertest');
const app = require('../../app');
const { User, Project, Task, Permission, Person } = require('../../models');
const bcrypt = require('bcrypt');
const { propfind, report } = require('../helpers/caldav-test-utils');

const ENC = encodeURIComponent;
const QUERY = `<?xml version="1.0"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter><C:comp-filter name="VTODO"/></C:filter>
</C:calendar-query>`;
const ALLPROP = '<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>';

const basic = (email) =>
    'Basic ' + Buffer.from(`${email}:password123`).toString('base64');

const vtodo = (uid, summary) =>
    [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Test//EN',
        'BEGIN:VTODO',
        `UID:${uid}`,
        `SUMMARY:${summary}`,
        'STATUS:NEEDS-ACTION',
        'END:VTODO',
        'END:VCALENDAR',
    ].join('\r\n');

// #1715: tasks in a shared project, and tasks assigned to someone, reach that
// person's CalDAV client.
describe('CalDAV shared projects and assigned tasks', () => {
    let owner;
    let member;
    let stranger;
    let project;
    let ownerTask;

    const createUser = async (email) =>
        User.create({
            email,
            password_digest: await bcrypt.hash('password123', 10),
            verified: true,
        });

    const share = (accessLevel) =>
        Permission.create({
            user_id: member.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: accessLevel,
            propagation: 'direct',
            granted_by_user_id: owner.id,
            status: 'accepted',
        });

    beforeEach(async () => {
        owner = await createUser('caldav-owner@test.com');
        member = await createUser('caldav-member@test.com');
        stranger = await createUser('caldav-stranger@test.com');
        project = await Project.create({
            uid: 'caldav-shared-project',
            user_id: owner.id,
            name: 'Shared Project',
        });
        ownerTask = await Task.create({
            uid: 'owner-task-1',
            name: 'Owner task',
            user_id: owner.id,
            project_id: project.id,
        });
    });

    describe('projects as calendars', () => {
        beforeEach(() => {
            process.env.CALDAV_PROJECTS_AS_CALENDARS = 'true';
        });

        afterEach(() => {
            delete process.env.CALDAV_PROJECTS_AS_CALENDARS;
        });

        const projectUrl = (user) =>
            `/caldav/${ENC(user.email)}/projects/${ENC(project.uid)}/`;

        it('lists a shared project and every task in it for the member', async () => {
            await share('rw');

            const home = await propfind(
                app,
                `/caldav/${ENC(member.email)}/projects/`
            )
                .set('Authorization', basic(member.email))
                .set('Depth', '1')
                .set('Content-Type', 'application/xml')
                .send(ALLPROP)
                .expect(207);
            expect(home.text).toContain('Shared Project');

            const res = await report(app, projectUrl(member))
                .set('Authorization', basic(member.email))
                .set('Content-Type', 'application/xml')
                .send(QUERY)
                .expect(207);
            expect(res.text).toContain('SUMMARY:Owner task');
        });

        it("shows the member's tasks in the owner's project calendar", async () => {
            await share('rw');
            await Task.create({
                uid: 'member-task-1',
                name: 'Member task',
                user_id: member.id,
                project_id: project.id,
            });

            const res = await report(app, projectUrl(owner))
                .set('Authorization', basic(owner.email))
                .set('Content-Type', 'application/xml')
                .send(QUERY)
                .expect(207);
            expect(res.text).toContain('SUMMARY:Member task');
            expect(res.text).toContain('SUMMARY:Owner task');
        });

        it('advertises a read-only share as read-only and refuses edits', async () => {
            await share('ro');

            const res = await propfind(app, projectUrl(member))
                .set('Authorization', basic(member.email))
                .set('Depth', '0')
                .set('Content-Type', 'application/xml')
                .send(ALLPROP)
                .expect(207);
            expect(res.text).not.toContain('write-content');

            await request(app)
                .put(`${projectUrl(member)}${ownerTask.uid}.ics`)
                .set('Authorization', basic(member.email))
                .set('Content-Type', 'text/calendar')
                .send(vtodo(ownerTask.uid, 'Renamed'))
                .expect(403);
        });

        it('lets a read-write member edit a task without taking it over', async () => {
            await share('rw');

            await request(app)
                .put(`${projectUrl(member)}${ownerTask.uid}.ics`)
                .set('Authorization', basic(member.email))
                .set('Content-Type', 'text/calendar')
                .send(vtodo(ownerTask.uid, 'Renamed by member'))
                .expect(204);

            await ownerTask.reload();
            expect(ownerTask.name).toBe('Renamed by member');
            expect(ownerTask.user_id).toBe(owner.id);
            expect(ownerTask.project_id).toBe(project.id);
        });

        // eslint-disable-next-line jest/expect-expect
        it('hides the project from someone it is not shared with', async () => {
            await propfind(app, projectUrl(stranger))
                .set('Authorization', basic(stranger.email))
                .set('Depth', '1')
                .set('Content-Type', 'application/xml')
                .send(ALLPROP)
                .expect(404);
        });
    });

    describe('single tasks calendar', () => {
        const tasksUrl = (user) => `/caldav/${ENC(user.email)}/tasks/`;

        it('includes a task assigned to the member', async () => {
            const card = await Person.create({
                name: 'Member',
                user_id: owner.id,
                linked_user_id: member.id,
            });
            await ownerTask.update({ assigned_to: card.uid });

            const res = await report(app, tasksUrl(member))
                .set('Authorization', basic(member.email))
                .set('Content-Type', 'application/xml')
                .send(QUERY)
                .expect(207);
            expect(res.text).toContain('SUMMARY:Owner task');

            await request(app)
                .get(`${tasksUrl(member)}${ownerTask.uid}.ics`)
                .set('Authorization', basic(member.email))
                .expect(200);
        });

        it("does not show or serve someone else's task", async () => {
            const res = await report(app, tasksUrl(stranger))
                .set('Authorization', basic(stranger.email))
                .set('Content-Type', 'application/xml')
                .send(QUERY)
                .expect(207);
            expect(res.text).not.toContain('Owner task');

            await request(app)
                .get(`${tasksUrl(stranger)}${ownerTask.uid}.ics`)
                .set('Authorization', basic(stranger.email))
                .expect(404);
        });
    });
});
