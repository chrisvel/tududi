const request = require('supertest');
const bcrypt = require('bcrypt');
const axios = require('axios');
const app = require('../../app');
const { sequelize, User, Task, CalDAVCalendar, CalDAVRemoteCalendar, CalDAVSyncState } = require('../../models');
const syncEngine = require('../../modules/caldav/sync/sync-engine');
const encryptionService = require('../../modules/caldav/services/encryption-service');

jest.mock('axios');

describe('CalDAV Sync Engine', () => {
    let testUser;
    let calendar;
    let remoteCalendar;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        testUser = await User.create({
            email: 'synctest@test.com',
            password_digest: await bcrypt.hash('password', 10),
            verified: true,
        });

        calendar = await CalDAVCalendar.create({
            uid: 'calendar-uid-1',
            user_id: testUser.id,
            name: 'Test Calendar',
            enabled: true,
            sync_direction: 'bidirectional',
            sync_interval_minutes: 15,
            conflict_resolution: 'last_write_wins',
        });

        remoteCalendar = await CalDAVRemoteCalendar.create({
            user_id: testUser.id,
            local_calendar_id: calendar.id,
            name: 'Remote Test Calendar',
            server_url: 'https://caldav.example.com',
            calendar_path: '/calendars/test/tasks/',
            username: 'testuser',
            password_encrypted: encryptionService.encrypt('password123'),
            auth_type: 'basic',
            enabled: true,
            sync_direction: 'bidirectional',
        });
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

    describe('Pull Phase', () => {
        test('should fetch and create new tasks from remote', async () => {
            const mockReportResponse = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendars/test/tasks/task-1.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"etag-task-1"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tududi//EN
BEGIN:VTODO
UID:remote-task-1
SUMMARY:Remote Task
STATUS:NEEDS-ACTION
PRIORITY:5
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:sync-token>new-sync-token-123</d:sync-token>
</d:multistatus>`;

            axios.mockResolvedValue({
                status: 207,
                data: mockReportResponse,
                headers: {},
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'pull' }
            );

            expect(result.success).toBe(true);
            expect(result.stats.pulled).toBeGreaterThan(0);

            const createdTask = await Task.findOne({
                where: { uid: 'remote-task-1' },
            });
            expect(createdTask).toBeTruthy();
            expect(createdTask.name).toBe('Remote Task');
        });

        test('should detect deleted tasks from remote', async () => {
            const localTask = await Task.create({
                uid: 'task-to-delete',
                user_id: testUser.id,
                name: 'Task to Delete',
                status: 0,
            });

            await CalDAVSyncState.create({
                task_id: localTask.id,
                calendar_id: calendar.id,
                etag: 'old-etag',
                last_modified: new Date(),
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            const mockReportResponse = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/calendars/test/tasks/task-to-delete.ics</d:href>
    <d:status>HTTP/1.1 404 Not Found</d:status>
  </d:response>
</d:multistatus>`;

            axios.mockResolvedValue({
                status: 207,
                data: mockReportResponse,
                headers: {},
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'pull' }
            );

            expect(result.success).toBe(true);

            const deletedTask = await Task.findOne({
                where: { uid: 'task-to-delete' },
            });
            expect(deletedTask).toBeNull();
        });

        test('should handle authentication failure', async () => {
            axios.mockRejectedValue({
                response: { status: 401 },
                message: 'Unauthorized',
            });

            await expect(
                syncEngine.syncCalendar(calendar.id, testUser.id, {
                    direction: 'pull',
                })
            ).rejects.toThrow();
        });
    });

    describe('Merge Phase', () => {
        test('should update task from remote when only remote modified', async () => {
            const task = await Task.create({
                uid: 'test-task',
                user_id: testUser.id,
                name: 'Original Name',
                status: 0,
            });

            const pastTime = new Date(Date.now() - 10000);
            await CalDAVSyncState.create({
                task_id: task.id,
                calendar_id: calendar.id,
                etag: 'old-etag',
                last_modified: pastTime,
                last_synced_at: pastTime,
                sync_status: 'synced',
            });

            const mockReportResponse = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendars/test/tasks/test-task.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"new-etag"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:test-task
SUMMARY:Updated Name from Remote
STATUS:IN-PROCESS
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

            axios.mockResolvedValue({
                status: 207,
                data: mockReportResponse,
                headers: {},
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'pull' }
            );

            expect(result.success).toBe(true);

            await task.reload();
            expect(task.name).toBe('Updated Name from Remote');
            expect(task.status).toBe(1);
        });

        test('should detect conflict when both local and remote modified', async () => {
            const task = await Task.create({
                uid: 'conflict-task',
                user_id: testUser.id,
                name: 'Original Name',
                status: 0,
            });

            const pastTime = new Date(Date.now() - 10000);
            await CalDAVSyncState.create({
                task_id: task.id,
                calendar_id: calendar.id,
                etag: 'old-etag',
                last_modified: pastTime,
                last_synced_at: pastTime,
                sync_status: 'synced',
            });

            await task.update({ name: 'Local Update' });

            const mockReportResponse = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendars/test/tasks/conflict-task.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"new-etag"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:conflict-task
SUMMARY:Remote Update
STATUS:IN-PROCESS
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

            axios.mockResolvedValue({
                status: 207,
                data: mockReportResponse,
                headers: {},
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'pull' }
            );

            expect(result.success).toBe(true);
        });
    });

    describe('Push Phase', () => {
        test('should push new local task to remote', async () => {
            const task = await Task.create({
                uid: 'new-local-task',
                user_id: testUser.id,
                name: 'New Local Task',
                status: 0,
            });

            axios.mockResolvedValue({
                status: 201,
                headers: {
                    etag: '"new-task-etag"',
                },
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'push' }
            );

            expect(result.success).toBe(true);
            expect(result.stats.pushed).toBeGreaterThan(0);
            expect(axios).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'PUT',
                    url: expect.stringContaining('new-local-task.ics'),
                })
            );
        });

        test('should push modified local task to remote', async () => {
            const task = await Task.create({
                uid: 'modified-task',
                user_id: testUser.id,
                name: 'Modified Task',
                status: 1,
            });

            const pastTime = new Date(Date.now() - 10000);
            await CalDAVSyncState.create({
                task_id: task.id,
                calendar_id: calendar.id,
                etag: 'old-etag',
                last_modified: pastTime,
                last_synced_at: pastTime,
                sync_status: 'synced',
            });

            await task.update({ name: 'Updated Locally' });

            axios.mockResolvedValue({
                status: 204,
                headers: {
                    etag: '"updated-etag"',
                },
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'push' }
            );

            expect(result.success).toBe(true);
            expect(result.stats.pushed).toBeGreaterThan(0);
        });

        test('should detect conflict on push with precondition failed', async () => {
            const task = await Task.create({
                uid: 'push-conflict-task',
                user_id: testUser.id,
                name: 'Task',
                status: 0,
            });

            await CalDAVSyncState.create({
                task_id: task.id,
                calendar_id: calendar.id,
                etag: 'etag-1',
                last_modified: new Date(),
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            await task.update({ name: 'Local Update' });

            axios.mockRejectedValue({
                response: { status: 412 },
                message: 'Precondition Failed',
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'push' }
            );

            expect(result.success).toBe(true);
            expect(result.phases.push.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Bidirectional Sync', () => {
        test('should complete full bidirectional sync', async () => {
            const localTask = await Task.create({
                uid: 'local-task',
                user_id: testUser.id,
                name: 'Local Task',
                status: 0,
            });

            const mockReportResponse = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendars/test/tasks/remote-task.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"remote-etag"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:remote-task
SUMMARY:Remote Task
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

            axios.mockImplementation((config) => {
                if (config.method === 'REPORT') {
                    return Promise.resolve({
                        status: 207,
                        data: mockReportResponse,
                        headers: {},
                    });
                } else if (config.method === 'PUT') {
                    return Promise.resolve({
                        status: 201,
                        headers: { etag: '"new-etag"' },
                    });
                }
                return Promise.reject(new Error('Unexpected request'));
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'bidirectional' }
            );

            expect(result.success).toBe(true);
            expect(result.stats.pulled).toBeGreaterThan(0);
            expect(result.stats.pushed).toBeGreaterThan(0);

            const remoteTaskLocal = await Task.findOne({
                where: { uid: 'remote-task' },
            });
            expect(remoteTaskLocal).toBeTruthy();
        });
    });

    describe('Dry Run Mode', () => {
        test('should not apply changes in dry run mode', async () => {
            const mockReportResponse = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendars/test/tasks/dry-run-task.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"dry-run-etag"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:dry-run-task
SUMMARY:Dry Run Task
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

            axios.mockResolvedValue({
                status: 207,
                data: mockReportResponse,
                headers: {},
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'pull', dryRun: true }
            );

            expect(result.success).toBe(true);
            expect(result.dryRun).toBe(true);

            const task = await Task.findOne({ where: { uid: 'dry-run-task' } });
            expect(task).toBeNull();
        });
    });

    describe('Sync Status', () => {
        test('should update calendar sync status on success', async () => {
            axios.mockResolvedValue({
                status: 207,
                data: '<?xml version="1.0" encoding="utf-8" ?><d:multistatus xmlns:d="DAV:"></d:multistatus>',
                headers: {},
            });

            await syncEngine.syncCalendar(calendar.id, testUser.id);

            await calendar.reload();
            expect(calendar.last_sync_at).toBeTruthy();
            expect(calendar.last_sync_status).toBe('success');
        });

        test('should update calendar sync status on error', async () => {
            axios.mockRejectedValue(new Error('Network error'));

            await expect(
                syncEngine.syncCalendar(calendar.id, testUser.id)
            ).rejects.toThrow();

            await calendar.reload();
            expect(calendar.last_sync_status).toBe('error');
        });
    });

    describe('Conflict Resolution Strategies', () => {
        test('should use local_wins strategy', async () => {
            await calendar.update({ conflict_resolution: 'local_wins' });

            const task = await Task.create({
                uid: 'strategy-test-task',
                user_id: testUser.id,
                name: 'Local Version',
                status: 1,
            });

            const pastTime = new Date(Date.now() - 10000);
            await CalDAVSyncState.create({
                task_id: task.id,
                calendar_id: calendar.id,
                etag: 'old-etag',
                last_modified: pastTime,
                last_synced_at: pastTime,
                sync_status: 'synced',
            });

            await task.update({ name: 'Updated Local Version' });

            const mockReportResponse = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendars/test/tasks/strategy-test-task.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"new-etag"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:strategy-test-task
SUMMARY:Remote Version
STATUS:COMPLETED
END:VTODO
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

            axios.mockResolvedValue({
                status: 207,
                data: mockReportResponse,
                headers: {},
            });

            const result = await syncEngine.syncCalendar(
                calendar.id,
                testUser.id,
                { direction: 'pull' }
            );

            expect(result.success).toBe(true);

            await task.reload();
            expect(task.name).toBe('Updated Local Version');
        });
    });
});
