const request = require('supertest');
const app = require('../../app');
const { Task, CalDAVCalendar } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Regression tests for #1371: tasks that are visible in the UI but whose uid
// cannot be resolved server-side ("ghost tasks") answered 403 Forbidden to
// every request, so the row could never be removed. Tasks synced from CalDAV
// clients also carry a remote UID that Tududi's uid format check rejected.
describe('Ghost tasks and externally synced uids', () => {
    let user, otherUser, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `ghost_${Date.now()}@example.com`,
        });
        otherUser = await createTestUser({
            email: `other_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    describe('tasks that no longer exist', () => {
        const missingUid = 'abcdefghijklmno';

        it('GET /api/task/:uid returns 404, not 403', async () => {
            const res = await agent.get(`/api/task/${missingUid}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Task not found.');
        });

        it('DELETE /api/task/:uid returns 404, not 403', async () => {
            const res = await agent.delete(`/api/task/${missingUid}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Task not found.');
        });

        it('PATCH /api/task/:uid returns 404, not 403', async () => {
            const res = await agent
                .patch(`/api/task/${missingUid}`)
                .send({ status: 2 });
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Task not found.');
        });

        it("still returns 403 for another user's existing task", async () => {
            const otherTask = await Task.create({
                name: 'Other Task',
                user_id: otherUser.id,
            });

            const get = await agent.get(`/api/task/${otherTask.uid}`);
            expect(get.status).toBe(403);
            expect(get.body.error).toBe('Forbidden');

            const del = await agent.delete(`/api/task/${otherTask.uid}`);
            expect(del.status).toBe(403);
            expect(del.body.error).toBe('Forbidden');
        });
    });

    describe('tasks created by a CalDAV client', () => {
        // tasks.org / DAVx5 keep their own VTODO UID, which is not a Tududi uid
        const remoteUid = '3f7c2b1a-8e5d-4c9f-9a2b-1d6e4f0a7c33';
        let authHeader;

        beforeEach(async () => {
            await CalDAVCalendar.create({
                uid: `cal-${Date.now()}`,
                user_id: user.id,
                name: 'Test Calendar',
                enabled: true,
            });

            authHeader =
                'Basic ' +
                Buffer.from(`${user.email}:password123`).toString('base64');

            const vtodo = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//tasks.org//android//EN',
                'BEGIN:VTODO',
                `UID:${remoteUid}`,
                'SUMMARY:Double check MX records',
                'DUE;VALUE=DATE:20260809',
                'STATUS:NEEDS-ACTION',
                'END:VTODO',
                'END:VCALENDAR',
            ].join('\r\n');

            await request(app)
                .put(
                    `/caldav/${encodeURIComponent(user.email)}/tasks/${remoteUid}.ics`
                )
                .set('Authorization', authHeader)
                .set('Content-Type', 'text/calendar')
                .send(vtodo)
                .expect(201);
        });

        it('stores the remote uid', async () => {
            const task = await Task.findOne({ where: { uid: remoteUid } });
            expect(task).not.toBeNull();
            expect(task.user_id).toBe(user.id);
        });

        it('serves the subtasks endpoint', async () => {
            const res = await agent.get(`/api/task/${remoteUid}/subtasks`);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('serves the next-iterations endpoint', async () => {
            const res = await agent.get(
                `/api/task/${remoteUid}/next-iterations`
            );
            expect(res.status).toBe(200);
            expect(res.body.iterations).toEqual([]);
        });

        it('serves the timeline endpoint', async () => {
            const res = await agent.get(`/api/task/${remoteUid}/timeline`);
            expect(res.status).toBe(200);
        });

        it('can be fetched and deleted from the web UI', async () => {
            const get = await agent.get(`/api/task/${remoteUid}`);
            expect(get.status).toBe(200);
            expect(get.body.uid).toBe(remoteUid);

            const del = await agent.delete(`/api/task/${remoteUid}`);
            expect(del.status).toBe(200);

            expect(
                await Task.findOne({ where: { uid: remoteUid } })
            ).toBeNull();
        });

        it('rejects an empty or oversized uid with 400', async () => {
            const res = await agent.get(
                `/api/task/${'x'.repeat(256)}/subtasks`
            );
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid UID');
        });
    });
});
