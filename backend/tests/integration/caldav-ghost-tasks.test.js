const request = require('supertest');
const bcrypt = require('bcrypt');
const axios = require('axios');
const app = require('../../app');
const {
    sequelize,
    User,
    Task,
    CalDAVCalendar,
    CalDAVRemoteCalendar,
    CalDAVSyncState,
} = require('../../models');
const syncEngine = require('../../modules/caldav/sync/sync-engine');
const encryptionService = require('../../modules/caldav/services/encryption-service');
const {
    normalizeHref,
    buildRemoteTaskUrl,
    extractUidFromHref,
} = require('../../modules/caldav/utils/href-utils');

jest.mock('axios');

// A "ghost task" (#1371) is a task that comes back after every delete. It is
// created by a CalDAV client such as tasks.org, so its VTODO lives at a path the
// client chose, and its UID is a remote UUID rather than a Tududi nanoid.
const REMOTE_UID = '3f7c2b1a-8e5d-4c9f-9a2b-1d6e4f0a7c33';
const REMOTE_HREF = '/calendars/test/tasks/1754712345678-9021.ics';

function reportWithTask(href, uid, etag) {
    return `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>${href}</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"${etag}"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:${uid}
SUMMARY:Ghost Task
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
}

describe('CalDAV ghost tasks', () => {
    let testUser;
    let calendar;
    let remoteCalendar;
    let agent;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        testUser = await User.create({
            email: 'ghost@test.com',
            password_digest: await bcrypt.hash('password123', 10),
            verified: true,
        });

        calendar = await CalDAVCalendar.create({
            uid: 'ghost-calendar-uid',
            user_id: testUser.id,
            name: 'Ghost Calendar',
            enabled: true,
            sync_direction: 'bidirectional',
            sync_interval_minutes: 15,
            conflict_resolution: 'last_write_wins',
        });

        remoteCalendar = await CalDAVRemoteCalendar.create({
            user_id: testUser.id,
            local_calendar_id: calendar.id,
            name: 'Ghost Remote Calendar',
            server_url: 'https://caldav.example.com',
            calendar_path: '/calendars/test/tasks/',
            username: 'testuser',
            password_encrypted: encryptionService.encrypt('password123'),
            auth_type: 'basic',
            enabled: true,
            sync_direction: 'bidirectional',
        });

        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: 'ghost@test.com', password: 'password123' });
    });

    afterEach(async () => {
        await CalDAVSyncState.destroy({ where: {} });
        await CalDAVRemoteCalendar.destroy({ where: {} });
        await CalDAVCalendar.destroy({ where: {} });
        await Task.destroy({ where: {} });
        await User.destroy({ where: {} });
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await sequelize.close();
    });

    async function pullGhostTask() {
        axios.mockResolvedValueOnce({
            status: 207,
            data: reportWithTask(REMOTE_HREF, REMOTE_UID, 'etag-1'),
        });

        await syncEngine.syncCalendar(calendar.id, testUser.id, {
            direction: 'pull',
        });

        return Task.findOne({ where: { uid: REMOTE_UID } });
    }

    describe('href utilities', () => {
        test('normalizes absolute and relative hrefs to a path', () => {
            expect(normalizeHref('https://caldav.example.com/cal/a.ics')).toBe(
                '/cal/a.ics'
            );
            expect(normalizeHref('/cal/a.ics')).toBe('/cal/a.ics');
            expect(normalizeHref('cal/a.ics')).toBe('/cal/a.ics');
            expect(normalizeHref('')).toBeNull();
            expect(normalizeHref(null)).toBeNull();
        });

        test('prefers the recorded href over a uid-derived path', () => {
            expect(
                buildRemoteTaskUrl(remoteCalendar, REMOTE_HREF, REMOTE_UID)
            ).toBe(`https://caldav.example.com${REMOTE_HREF}`);
        });

        test('falls back to <uid>.ics when no href is recorded', () => {
            expect(buildRemoteTaskUrl(remoteCalendar, null, 'abc123')).toBe(
                'https://caldav.example.com/calendars/test/tasks/abc123.ics'
            );
        });

        test('extracts a uid from a conventional href', () => {
            expect(extractUidFromHref('/cal/task-1.ics')).toBe('task-1');
        });
    });

    describe('pull phase', () => {
        test('records the remote href of a pulled task', async () => {
            const task = await pullGhostTask();

            expect(task).not.toBeNull();

            const syncState = await CalDAVSyncState.findOne({
                where: { task_id: task.id, calendar_id: calendar.id },
            });

            expect(syncState.remote_href).toBe(REMOTE_HREF);
        });
    });

    describe('deleting a task in Tududi', () => {
        test('deletes the remote resource at its real href, not <uid>.ics', async () => {
            const task = await pullGhostTask();

            axios.mockResolvedValueOnce({ status: 204 });

            const response = await agent.delete(`/api/task/${task.uid}`);
            expect(response.status).toBe(200);

            const deleteCall = axios.mock.calls
                .map(([config]) => config)
                .find((config) => config.method === 'DELETE');

            expect(deleteCall).toBeDefined();
            expect(deleteCall.url).toBe(
                `https://caldav.example.com${REMOTE_HREF}`
            );
            // The path the old code guessed, which 404s on the real server.
            expect(deleteCall.url).not.toContain(`${REMOTE_UID}.ics`);
        });

        test('does not resurrect the task on the next pull', async () => {
            const task = await pullGhostTask();

            axios.mockResolvedValueOnce({ status: 204 });
            await agent.delete(`/api/task/${task.uid}`);

            // The server no longer lists the resource, because the DELETE above
            // actually reached it.
            axios.mockResolvedValueOnce({
                status: 207,
                data: `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
</d:multistatus>`,
            });

            await syncEngine.syncCalendar(calendar.id, testUser.id, {
                direction: 'pull',
            });

            expect(
                await Task.findOne({ where: { uid: REMOTE_UID } })
            ).toBeNull();
        });

        test('removes the sync state so no row is orphaned', async () => {
            const task = await pullGhostTask();

            axios.mockResolvedValueOnce({ status: 204 });
            await agent.delete(`/api/task/${task.uid}`);

            const remaining = await CalDAVSyncState.findAll({
                where: { task_id: task.id },
            });
            expect(remaining).toHaveLength(0);
        });

        test('still deletes locally when the remote server is unreachable', async () => {
            const task = await pullGhostTask();

            axios.mockRejectedValueOnce(new Error('ECONNREFUSED'));

            const response = await agent.delete(`/api/task/${task.uid}`);

            expect(response.status).toBe(200);
            expect(await Task.findByPk(task.id)).toBeNull();
        });

        test('deletes locally when the resource is already gone remotely', async () => {
            const task = await pullGhostTask();

            axios.mockRejectedValueOnce({ response: { status: 404 } });

            const response = await agent.delete(`/api/task/${task.uid}`);

            expect(response.status).toBe(200);
            expect(await Task.findByPk(task.id)).toBeNull();
        });

        test('makes no remote call for a task that was never synced', async () => {
            const localTask = await Task.create({
                uid: 'local-only-task',
                user_id: testUser.id,
                name: 'Local only',
                status: 0,
            });

            const response = await agent.delete(`/api/task/${localTask.uid}`);

            expect(response.status).toBe(200);
            expect(axios).not.toHaveBeenCalled();
        });
    });

    describe('pushing a task back to the remote', () => {
        test('updates the existing resource instead of creating a duplicate', async () => {
            const task = await pullGhostTask();

            await CalDAVSyncState.update(
                { last_synced_at: new Date(Date.now() - 60000) },
                { where: { task_id: task.id, calendar_id: calendar.id } }
            );
            await task.update({ name: 'Renamed in Tududi' });

            axios.mockResolvedValueOnce({
                status: 204,
                headers: { etag: '"etag-2"' },
            });

            await syncEngine.syncCalendar(calendar.id, testUser.id, {
                direction: 'push',
            });

            const putCall = axios.mock.calls
                .map(([config]) => config)
                .find((config) => config.method === 'PUT');

            expect(putCall).toBeDefined();
            expect(putCall.url).toBe(
                `https://caldav.example.com${REMOTE_HREF}`
            );
        });
    });

    describe('remote deletion of an externally created task', () => {
        test('deletes the local task matched by href, not by filename', async () => {
            const task = await pullGhostTask();

            axios.mockResolvedValueOnce({
                status: 207,
                data: `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${REMOTE_HREF}</d:href>
    <d:status>HTTP/1.1 404 Not Found</d:status>
  </d:response>
</d:multistatus>`,
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'pull' }
            );

            expect(result.phases.merge.deleted).toHaveLength(1);
            expect(await Task.findByPk(task.id)).toBeNull();
            expect(
                await CalDAVSyncState.findAll({ where: { task_id: task.id } })
            ).toHaveLength(0);
        });
    });
});
