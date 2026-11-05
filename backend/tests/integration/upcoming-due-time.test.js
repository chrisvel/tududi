const request = require('supertest');
const app = require('../../app');
const moment = require('moment-timezone');
const { createTestUser } = require('../helpers/testUtils');

// Issue #1932: Upcoming shows a recurring due time as the local clock of UTC
// midnight (00:00 in UTC, 19:00 in Chicago, 12:00 in Pacific/Fiji). Editing
// the time to 06:00 stores 06:00, but the Upcoming read path still returns
// that wrong instant.
async function login(timezone) {
    const user = await createTestUser({
        email: `upcoming-due-${timezone.replace(/\//g, '-')}@example.com`,
        timezone,
    });
    const agent = request.agent(app);
    await agent.post('/api/login').send({
        email: user.email,
        password: 'password123',
    });
    return agent;
}

function tasksInGroups(groupedTasks) {
    return Object.values(groupedTasks || {}).flat();
}

function seriesNamed(groupedTasks, name) {
    return tasksInGroups(groupedTasks).filter(
        (task) => task.original_name === name || task.name === name
    );
}

// What Upcoming shows when a timed instant has been replaced by a calendar
// date: that string is UTC midnight, then converted to the user's clock.
function droppedClock(date, timezone) {
    return moment.utc(date).tz(timezone).format('HH:mm');
}

describe('Upcoming due time (#1932)', () => {
    const zones = ['UTC', 'America/Chicago', 'Pacific/Fiji'];

    describe.each(zones)('timezone %s', (timezone) => {
        let agent;

        beforeEach(async () => {
            agent = await login(timezone);
        });

        it('shows a recurring series at its saved time, not UTC midnight', async () => {
            const today = moment.tz(timezone).format('YYYY-MM-DD');

            const created = await agent.post('/api/task').send({
                name: 'Review Inbox',
                due_date: today,
                due_time: '15:30',
                recurrence_type: 'daily',
                recurrence_interval: 1,
            });
            expect(created.status).toBe(201);
            expect(created.body.due_time).toBe('15:30');
            expect(created.body.due_has_time).toBe(true);

            const listed = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day&maxDays=7'
            );
            expect(listed.status).toBe(200);

            const occurrences = seriesNamed(
                listed.body.groupedTasks,
                'Review Inbox'
            );
            expect(occurrences.length).toBeGreaterThan(0);

            const todayRow = occurrences.find(
                (task) => task.due_date === today
            );
            expect(todayRow).toEqual(
                expect.objectContaining({
                    due_date: today,
                    due_time: '15:30',
                    due_has_time: true,
                })
            );
            expect(occurrences.map((task) => task.due_time)).not.toContain(
                droppedClock(today, timezone)
            );
        });

        it('keeps 06:00 on Upcoming after the inline edit is saved', async () => {
            const today = moment.tz(timezone).format('YYYY-MM-DD');

            const created = await agent.post('/api/task').send({
                name: 'Review Inbox',
                due_date: today,
                due_time: '15:30',
                recurrence_type: 'daily',
                recurrence_interval: 1,
            });
            expect(created.status).toBe(201);

            const listed = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day&maxDays=7'
            );
            const rows = seriesNamed(listed.body.groupedTasks, 'Review Inbox');
            expect(rows.length).toBeGreaterThan(0);
            const target =
                rows.find((task) => task.due_date === today) || rows[0];

            const edited = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ due_date: target.due_date, due_time: '06:00' });
            expect(edited.status).toBe(200);
            expect(edited.body.due_time).toBe('06:00');
            expect(edited.body.due_has_time).toBe(true);

            // Upcoming's handleTaskUpdate PATCHes the merged task again.
            const second = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({
                    ...target,
                    ...edited.body,
                    subtasks: edited.body.subtasks || target.subtasks || [],
                });
            expect(second.status).toBe(200);
            expect(second.body.due_time).toBe('06:00');

            const again = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day&maxDays=7'
            );
            const after = seriesNamed(again.body.groupedTasks, 'Review Inbox');
            const todayRow = after.find((task) => task.due_date === today);
            expect(todayRow).toEqual(
                expect.objectContaining({
                    due_date: today,
                    due_time: '06:00',
                    due_has_time: true,
                })
            );
            expect(after.map((task) => task.due_time)).not.toContain(
                droppedClock(today, timezone)
            );
        });

        it('leaves a date-only recurring series without a time', async () => {
            const today = moment.tz(timezone).format('YYYY-MM-DD');

            const created = await agent.post('/api/task').send({
                name: 'Date Only',
                due_date: today,
                recurrence_type: 'daily',
                recurrence_interval: 1,
            });
            expect(created.status).toBe(201);
            expect(created.body.due_has_time).toBe(false);
            expect(created.body.due_time).toBeNull();

            const listed = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day&maxDays=7'
            );
            const occurrences = seriesNamed(
                listed.body.groupedTasks,
                'Date Only'
            );
            expect(occurrences.length).toBeGreaterThan(0);
            expect(
                occurrences.every(
                    (task) =>
                        task.due_has_time === false && task.due_time == null
                )
            ).toBe(true);
        });

        it('keeps a non-recurring timed due when only the date changes', async () => {
            const today = moment.tz(timezone).format('YYYY-MM-DD');
            const tomorrow = moment
                .tz(timezone)
                .add(1, 'day')
                .format('YYYY-MM-DD');

            const created = await agent.post('/api/task').send({
                name: 'One off',
                due_date: today,
                due_time: '13:45',
            });
            expect(created.status).toBe(201);

            const moved = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ due_date: tomorrow, due_time: '13:45' });
            expect(moved.status).toBe(200);
            expect(moved.body.due_date).toBe(tomorrow);
            expect(moved.body.due_time).toBe('13:45');
            expect(moved.body.due_has_time).toBe(true);
        });
    });

    describe('DST transition wall-clock (Europe/Berlin)', () => {
        // Upcoming starts today, so pin the clock before the 2026-10-25 shift.
        // Only Date is faked; timers stay real for the app and supertest.
        beforeEach(() => {
            jest.useFakeTimers({
                now: new Date('2026-10-23T12:00:00Z'),
                doNotFake: [
                    'hrtime',
                    'nextTick',
                    'performance',
                    'queueMicrotask',
                    'requestAnimationFrame',
                    'cancelAnimationFrame',
                    'requestIdleCallback',
                    'cancelIdleCallback',
                    'setImmediate',
                    'clearImmediate',
                    'setInterval',
                    'clearInterval',
                    'setTimeout',
                    'clearTimeout',
                ],
            });
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('keeps 09:00 across the autumn DST shift on Upcoming', async () => {
            const agent = await login('Europe/Berlin');
            const created = await agent.post('/api/task').send({
                name: 'Morning Sync',
                due_date: '2026-10-24',
                due_time: '09:00',
                recurrence_type: 'daily',
                recurrence_interval: 1,
            });
            expect(created.status).toBe(201);
            expect(created.body.due_time).toBe('09:00');

            const listed = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day&maxDays=7'
            );
            expect(listed.status).toBe(200);

            const occurrences = seriesNamed(
                listed.body.groupedTasks,
                'Morning Sync'
            );
            expect(occurrences.length).toBeGreaterThanOrEqual(4);

            const byDate = {};
            for (const occ of occurrences) {
                byDate[occ.due_date] = occ.due_time;
            }

            expect(byDate['2026-10-24']).toBe('09:00');
            expect(byDate['2026-10-25']).toBe('09:00');
            expect(byDate['2026-10-26']).toBe('09:00');
            expect(byDate['2026-10-27']).toBe('09:00');
        });

        it('keeps 00:30 across the autumn DST shift on Upcoming without getting stuck', async () => {
            const agent = await login('Europe/Berlin');
            const created = await agent.post('/api/task').send({
                name: 'Midnight Sync',
                due_date: '2026-10-24',
                due_time: '00:30',
                recurrence_type: 'daily',
                recurrence_interval: 1,
            });
            expect(created.status).toBe(201);
            expect(created.body.due_time).toBe('00:30');

            const listed = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day&maxDays=7'
            );
            expect(listed.status).toBe(200);

            const occurrences = seriesNamed(
                listed.body.groupedTasks,
                'Midnight Sync'
            );
            expect(occurrences.length).toBeGreaterThanOrEqual(4);

            const byDate = {};
            for (const occ of occurrences) {
                byDate[occ.due_date] = occ.due_time;
            }

            expect(byDate['2026-10-24']).toBe('00:30');
            expect(byDate['2026-10-25']).toBe('00:30');
            expect(byDate['2026-10-26']).toBe('00:30');
            expect(byDate['2026-10-27']).toBe('00:30');
        });
    });
});
