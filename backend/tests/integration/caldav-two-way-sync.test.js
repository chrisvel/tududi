const request = require('supertest');
const axios = require('axios');
const app = require('../../app');
const {
    Task,
    CalDAVCalendar,
    CalDAVRemoteCalendar,
    CalDAVSyncState,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { propfind } = require('../helpers/caldav-test-utils');
const syncEngine = require('../../modules/caldav/sync/sync-engine');
const encryptionService = require('../../modules/caldav/services/encryption-service');

jest.mock('axios');
// The fake remote host does not resolve; these tests are about sync behavior.
jest.mock('../../modules/url/ssrfGuard', () => ({
    ...jest.requireActual('../../modules/url/ssrfGuard'),
    assertPublicHostname: jest.fn().mockResolvedValue(undefined),
}));

// #1822: edits made after the first sync, on either side, did not sync.

const EMAIL = 'two-way@test.com';
const BASIC = 'Basic ' + Buffer.from(`${EMAIL}:password123`).toString('base64');
const TASKS = `/caldav/${EMAIL}/tasks/`;

const vcalendar = (lines) =>
    [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:+//IDN tasks.org//android-140100//EN',
        'BEGIN:VTODO',
        ...lines,
        'END:VTODO',
        'END:VCALENDAR',
        '',
    ].join('\r\n');

const putTask = (filename, body, headers = {}) => {
    const req = request(app)
        .put(`${TASKS}${filename}`)
        .set('Authorization', BASIC)
        .set('Content-Type', 'text/calendar');
    Object.entries(headers).forEach(([k, v]) => req.set(k, v));
    return req.send(body);
};

const getTask = (uid) =>
    request(app).get(`${TASKS}${uid}.ics`).set('Authorization', BASIC);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CalDAV two-way sync (#1822)', () => {
    let user;
    let cookie;

    beforeEach(async () => {
        user = await createTestUser({ email: EMAIL, verified: true });
        const login = await request(app)
            .post('/api/login')
            .send({ email: EMAIL, password: 'password123' });
        cookie = login.headers['set-cookie'];
    });

    describe('Tududi as the CalDAV server', () => {
        const createTask = async (fields) => {
            const res = await request(app)
                .post('/api/task')
                .set('Cookie', cookie)
                .send(fields);
            expect(res.status).toBe(201);
            return res.body;
        };

        test.each([
            ['quoted', (etag) => etag],
            ['unquoted', (etag) => etag.replace(/"/g, '')],
        ])(
            'a client edit sent with a %s If-Match updates the same task',
            async (_label, formatEtag) => {
                const task = await createTask({ name: 'Original' });
                const fetched = await getTask(task.uid);

                const res = await putTask(
                    `${task.uid}.ics`,
                    fetched.text.replace(
                        'SUMMARY:Original',
                        'SUMMARY:Edited on the phone'
                    ),
                    { 'If-Match': formatEtag(fetched.headers.etag) }
                );

                expect(res.status).toBe(204);
                expect(await Task.count()).toBe(1);

                // The web app can still open, edit and delete it.
                const api = await request(app)
                    .get(`/api/task/${task.uid}`)
                    .set('Cookie', cookie);
                expect(api.status).toBe(200);
                expect(api.body.name).toBe('Edited on the phone');

                const patch = await request(app)
                    .patch(`/api/task/${task.uid}`)
                    .set('Cookie', cookie)
                    .send({ name: 'Edited on the web' });
                expect(patch.status).toBe(200);

                const del = await request(app)
                    .delete(`/api/task/${task.uid}`)
                    .set('Cookie', cookie);
                expect(del.status).toBe(200);
                expect(await Task.count()).toBe(0);
            }
        );

        test('the ETag from a PUT is the one later reads report', async () => {
            const task = await createTask({ name: 'Original' });
            const fetched = await getTask(task.uid);

            const put = await putTask(
                `${task.uid}.ics`,
                fetched.text.replace('SUMMARY:Original', 'SUMMARY:Edited'),
                { 'If-Match': fetched.headers.etag }
            );

            const after = await getTask(task.uid);
            expect(put.headers.etag).toBe(after.headers.etag);
        });

        test('a VTODO uploaded under a new filename with an existing UID does not create a second task', async () => {
            const task = await createTask({ name: 'Original' });

            const res = await putTask(
                'client-chosen-name.ics',
                vcalendar([`UID:${task.uid}`, 'SUMMARY:Duplicate'])
            );

            expect(res.status).toBe(409);
            expect(res.text).toContain('no-uid-conflict');
            expect(res.text).toContain(`${task.uid}.ics`);
            expect(await Task.count()).toBe(1);
            expect((await Task.findOne()).name).toBe('Original');
        });

        test('a client edit keeps a status iCalendar cannot express', async () => {
            const task = await createTask({ name: 'Waiting', status: 4 });
            const fetched = await getTask(task.uid);

            await putTask(
                `${task.uid}.ics`,
                fetched.text.replace('SUMMARY:Waiting', 'SUMMARY:Renamed'),
                { 'If-Match': fetched.headers.etag }
            );

            const row = await Task.findOne({ where: { uid: task.uid } });
            expect(row.name).toBe('Renamed');
            expect(row.status).toBe(4);
        });

        test('a client can still complete a task', async () => {
            const task = await createTask({ name: 'To finish', status: 4 });
            const fetched = await getTask(task.uid);

            await putTask(
                `${task.uid}.ics`,
                fetched.text.replace(
                    'STATUS:NEEDS-ACTION',
                    'STATUS:COMPLETED\r\nCOMPLETED:20261008T100000Z'
                ),
                { 'If-Match': fetched.headers.etag }
            );

            const row = await Task.findOne({ where: { uid: task.uid } });
            expect(row.status).toBe(2);
            expect(row.completed_at).not.toBeNull();
        });

        test('changing only the tags in Tududi changes the ETag and the CTag', async () => {
            const task = await createTask({ name: 'Tagged' });

            const ctag = async () => {
                const res = await propfind(app, TASKS)
                    .set('Authorization', BASIC)
                    .set('Depth', '0')
                    .send(
                        '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/"><d:prop><cs:getctag/></d:prop></d:propfind>'
                    );
                return res.text.match(/<CS:getctag>([^<]+)</)?.[1];
            };

            const etagBefore = (await getTask(task.uid)).headers.etag;
            const ctagBefore = await ctag();
            expect(ctagBefore).toBeDefined();

            await sleep(5);
            const patch = await request(app)
                .patch(`/api/task/${task.uid}`)
                .set('Cookie', cookie)
                .send({ tags: [{ name: 'errand' }] });
            expect(patch.status).toBe(200);

            const after = await getTask(task.uid);
            expect(after.text).toContain('CATEGORIES:errand');
            expect(after.headers.etag).not.toBe(etagBefore);
            expect(await ctag()).not.toBe(ctagBefore);
        });

        test('the collection CTag is served in the CalendarServer namespace', async () => {
            const res = await propfind(app, TASKS)
                .set('Authorization', BASIC)
                .set('Depth', '0')
                .send(
                    '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/"><d:prop><cs:getctag/></d:prop></d:propfind>'
                );

            expect(res.status).toBe(207);
            expect(res.text).toContain(
                'xmlns:CS="http://calendarserver.org/ns/"'
            );
            expect(res.text).toMatch(/<CS:getctag>"ctag-[^<]+<\/CS:getctag>/);
        });
    });

    describe('Tududi syncing to a remote CalDAV server', () => {
        let calendar;

        const setupRemote = async (overrides = {}) => {
            calendar = await CalDAVCalendar.create({
                uid: 'two-way-calendar',
                user_id: user.id,
                name: 'Radicale',
                enabled: true,
                sync_direction: 'bidirectional',
                sync_interval_minutes: 15,
                conflict_resolution: 'last_write_wins',
            });
            await CalDAVRemoteCalendar.create({
                user_id: user.id,
                local_calendar_id: calendar.id,
                name: 'Radicale tasks',
                server_url: 'https://dav.example.com',
                calendar_path: '/chris/tasks/',
                username: 'chris',
                password_encrypted: encryptionService.encrypt('secret'),
                auth_type: 'basic',
                enabled: true,
                sync_direction: 'bidirectional',
                ...overrides,
            });
        };

        const multistatus = (items) => ({
            status: 207,
            data: `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
${items
    .map(
        ({ href, etag, ics }) => `  <d:response>
    <d:href>${href}</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"${etag}"</d:getetag>
        <cal:calendar-data>${ics}</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`
    )
    .join('\n')}
</d:multistatus>`,
        });

        const calls = (method) =>
            axios.mock.calls
                .map(([config]) => config)
                .filter((config) => config.method === method);

        const sync = (direction = 'bidirectional') =>
            syncEngine.syncCalendar(calendar.id, user.id, { direction });

        test('later Tududi edits are pushed when the server lives under a path prefix', async () => {
            await setupRemote({
                server_url: 'https://dav.example.com/radicale',
            });
            const task = await Task.create({
                user_id: user.id,
                name: 'Pushed',
            });

            // First sync: the server has nothing; Tududi creates the resource.
            axios.mockResolvedValueOnce(multistatus([]));
            axios.mockResolvedValueOnce({
                status: 201,
                headers: { etag: '"e1"' },
            });
            await sync();

            expect(calls('PUT')[0].url).toBe(
                `https://dav.example.com/radicale/chris/tasks/${task.uid}.ics`
            );

            // The server reports the href with its prefix, as Radicale does.
            const href = `/radicale/chris/tasks/${task.uid}.ics`;
            await sleep(5);
            await task.update({ name: 'Edited later' });

            axios.mockResolvedValueOnce(
                multistatus([
                    {
                        href,
                        etag: 'e1',
                        ics: vcalendar([`UID:${task.uid}`, 'SUMMARY:Pushed']),
                    },
                ])
            );
            axios.mockResolvedValueOnce({
                status: 204,
                headers: { etag: '"e2"' },
            });
            await sync();

            const second = calls('PUT')[1];
            expect(second).toBeDefined();
            expect(second.url).toBe(`https://dav.example.com${href}`);
            expect(second.headers['If-Match']).toBe('"e1"');
            expect(second.data).toContain('SUMMARY:Edited later');
        });

        test('a push rejected with 412 does not leave the task stuck in conflict', async () => {
            await setupRemote();
            const task = await Task.create({
                user_id: user.id,
                name: 'Original',
            });
            const href = `/chris/tasks/${task.uid}.ics`;
            const remoteIcs = (summary, lastModified) =>
                vcalendar([
                    `UID:${task.uid}`,
                    `SUMMARY:${summary}`,
                    `LAST-MODIFIED:${lastModified}`,
                ]);

            await CalDAVSyncState.create({
                task_id: task.id,
                calendar_id: calendar.id,
                etag: 'e1',
                remote_href: href,
                last_modified: new Date(Date.now() - 3600000),
                last_synced_at: new Date(Date.now() - 3600000),
                sync_status: 'synced',
            });
            await task.update({ name: 'Edited in Tududi' });

            // Someone else changed the resource between our pull and push.
            axios.mockResolvedValueOnce(
                multistatus([
                    {
                        href,
                        etag: 'e1',
                        ics: remoteIcs('Original', '20200101T000000Z'),
                    },
                ])
            );
            axios.mockRejectedValueOnce({ response: { status: 412 } });
            await sync();

            const state = () =>
                CalDAVSyncState.findOne({ where: { task_id: task.id } });
            expect((await state()).sync_status).toBe('conflict');

            // Next sync: the remote change is older than the local edit, so the
            // local edit wins and goes out with the server's current etag.
            axios.mockResolvedValueOnce(
                multistatus([
                    {
                        href,
                        etag: 'e2',
                        ics: remoteIcs('Remote edit', '20200102T000000Z'),
                    },
                ])
            );
            axios.mockResolvedValueOnce({
                status: 204,
                headers: { etag: '"e3"' },
            });
            await sync();

            const puts = calls('PUT');
            expect(puts).toHaveLength(2);
            expect(puts[1].headers['If-Match']).toBe('"e2"');
            expect(puts[1].data).toContain('SUMMARY:Edited in Tududi');

            await task.reload();
            expect(task.name).toBe('Edited in Tududi');
            const settled = await state();
            expect(settled.sync_status).toBe('synced');
            expect(settled.etag).toBe('e3');
        });

        test('a newer remote edit wins a conflict and is applied locally', async () => {
            await setupRemote();
            const task = await Task.create({
                user_id: user.id,
                name: 'Original',
            });
            const href = `/chris/tasks/${task.uid}.ics`;
            await CalDAVSyncState.create({
                task_id: task.id,
                calendar_id: calendar.id,
                etag: 'e1',
                remote_href: href,
                last_modified: new Date(Date.now() - 3600000),
                last_synced_at: new Date(Date.now() - 3600000),
                sync_status: 'synced',
            });
            await task.update({ name: 'Local edit' });

            axios.mockResolvedValueOnce(
                multistatus([
                    {
                        href,
                        etag: 'e2',
                        ics: vcalendar([
                            `UID:${task.uid}`,
                            'SUMMARY:Phone edit',
                            'LAST-MODIFIED:20991231T000000Z',
                        ]),
                    },
                ])
            );
            await sync();

            await task.reload();
            expect(task.name).toBe('Phone edit');
            expect(calls('PUT')).toHaveLength(0);
        });

        test('a date-only due date pulled from the server keeps its day in the user timezone', async () => {
            await user.update({ timezone: 'Europe/Athens' });
            await setupRemote();

            axios.mockResolvedValueOnce(
                multistatus([
                    {
                        href: '/chris/tasks/phone-task.ics',
                        etag: 'e1',
                        ics: vcalendar([
                            'UID:phone-task',
                            'SUMMARY:From the phone',
                            'DUE;VALUE=DATE:20261020',
                        ]),
                    },
                ])
            );
            await sync('pull');

            const api = await request(app)
                .get('/api/task/phone-task')
                .set('Cookie', cookie);
            expect(api.status).toBe(200);
            expect(api.body.due_date).toBe('2026-10-20');
        });

        test('a pushed task carries its tags', async () => {
            await setupRemote();
            const created = await request(app)
                .post('/api/task')
                .set('Cookie', cookie)
                .send({ name: 'With tags', tags: [{ name: 'home' }] });
            expect(created.status).toBe(201);

            axios.mockResolvedValueOnce(multistatus([]));
            axios.mockResolvedValueOnce({
                status: 201,
                headers: { etag: '"e1"' },
            });
            await sync();

            expect(calls('PUT')[0].data).toContain('CATEGORIES:home');
        });

        describe('deletions made on the server', () => {
            const syncedState = (task, overrides = {}) =>
                CalDAVSyncState.create({
                    task_id: task.id,
                    calendar_id: calendar.id,
                    etag: 'e1',
                    remote_href: `/chris/tasks/${task.uid}.ics`,
                    last_modified: new Date(),
                    last_synced_at: new Date(),
                    sync_status: 'synced',
                    ...overrides,
                });

            test('a task deleted on the server is deleted in Tududi on the next sync', async () => {
                await setupRemote();
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Deleted on the phone',
                });
                await sleep(5);
                await syncedState(task);

                // Radicale answers a calendar-query with what exists, and
                // never with a sync-token, so this is all Tududi gets.
                axios.mockResolvedValueOnce(multistatus([]));
                const result = await sync();

                expect(result.phases.merge.deleted).toHaveLength(1);
                expect(await Task.count()).toBe(0);
                expect(await CalDAVSyncState.count()).toBe(0);
                expect(calls('PUT')).toHaveLength(0);
            });

            test('a task never pushed yet is not mistaken for a remote deletion', async () => {
                await setupRemote();
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Brand new',
                });

                axios.mockResolvedValueOnce(multistatus([]));
                axios.mockResolvedValueOnce({
                    status: 201,
                    headers: { etag: '"e1"' },
                });
                await sync();

                expect(await Task.count()).toBe(1);
                expect(calls('PUT')[0].url).toBe(
                    `https://dav.example.com/chris/tasks/${task.uid}.ics`
                );
            });

            test('a differently encoded href in the listing does not read as a deletion', async () => {
                await setupRemote();
                const task = await Task.create({
                    user_id: user.id,
                    uid: 'a@b',
                    name: 'Odd uid',
                });
                await sleep(5);
                await syncedState(task, {
                    remote_href: '/chris/tasks/a%40b.ics',
                });

                axios.mockResolvedValueOnce(
                    multistatus([
                        {
                            href: '/chris/tasks/a@b.ics',
                            etag: 'e1',
                            ics: vcalendar(['UID:a@b', 'SUMMARY:Odd uid']),
                        },
                    ])
                );
                await sync();

                expect(await Task.count()).toBe(1);
                expect(await CalDAVSyncState.count()).toBe(1);
            });

            test('a task edited in Tududi after it was deleted on the server is created there again', async () => {
                await setupRemote();
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Original',
                });
                await syncedState(task, {
                    last_modified: new Date(Date.now() - 3600000),
                    last_synced_at: new Date(Date.now() - 3600000),
                });
                await task.update({ name: 'Edited after the deletion' });

                axios.mockResolvedValueOnce(multistatus([]));
                axios.mockResolvedValueOnce({
                    status: 201,
                    headers: { etag: '"e2"' },
                });
                await sync();

                const puts = calls('PUT');
                expect(puts).toHaveLength(1);
                expect(puts[0].url).toBe(
                    `https://dav.example.com/chris/tasks/${task.uid}.ics`
                );
                expect(puts[0].headers['If-Match']).toBeUndefined();
                expect(puts[0].data).toContain(
                    'SUMMARY:Edited after the deletion'
                );

                expect(await Task.count()).toBe(1);
                const state = await CalDAVSyncState.findOne({
                    where: { task_id: task.id },
                });
                expect(state.sync_status).toBe('synced');
                expect(state.etag).toBe('e2');
                expect(state.remote_href).toBe(`/chris/tasks/${task.uid}.ics`);
            });

            test('with manual conflict resolution the locally edited task is kept and flagged', async () => {
                await setupRemote();
                await calendar.update({ conflict_resolution: 'manual' });
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Original',
                });
                await syncedState(task, {
                    last_synced_at: new Date(Date.now() - 3600000),
                });
                await task.update({ name: 'Edited after the deletion' });

                axios.mockResolvedValueOnce(multistatus([]));
                const result = await sync();

                expect(result.phases.merge.conflicts).toHaveLength(1);
                expect(await Task.count()).toBe(1);
                expect(calls('PUT')).toHaveLength(0);
                const state = await CalDAVSyncState.findOne({
                    where: { task_id: task.id },
                });
                expect(state.sync_status).toBe('conflict');
            });

            test('a sync-collection reply is trusted as is and not diffed', async () => {
                await setupRemote({ server_sync_token: 'token-1' });
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Unchanged',
                });
                await sleep(5);
                await syncedState(task);

                // sync-collection lists only what changed, so an empty reply
                // means nothing happened, not that everything is gone.
                axios.mockResolvedValueOnce(multistatus([]));
                await sync();

                expect(await Task.count()).toBe(1);
                expect(await CalDAVSyncState.count()).toBe(1);
            });
        });
    });
});
