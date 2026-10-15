const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');
const { sequelize, User, Task } = require('../../../models');
const migration = require('../../../migrations/20261015120000-repair-caldav-imported-defer-dates');

// The whole-day due date Tududi stores is the end of the day in the owner's
// timezone; Europe/Berlin is UTC+2 in October.
const BERLIN_DAY_END = '2026-10-17T21:59:59.999Z';
const BERLIN_DAY_START = '2026-10-16T22:00:00.000Z';
const BERLIN_EARLIER_START = '2026-10-14T22:00:00.000Z';

let userCounter = 0;

async function createUser(timezone) {
    userCounter += 1;
    return User.create({
        email: `repair-${userCounter}@test.com`,
        password_digest: await bcrypt.hash('password', 10),
        verified: true,
        timezone,
    });
}

async function createTask(user, overrides = {}) {
    userCounter += 1;
    return Task.create({
        uid: `repair-task-${userCounter}`,
        user_id: user.id,
        name: `Repair task ${userCounter}`,
        status: 0,
        ...overrides,
    });
}

function runUp() {
    return migration.up(sequelize.getQueryInterface(), Sequelize);
}

describe('migration 20261015120000-repair-caldav-imported-defer-dates', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('clears the defer date a client never set on a whole-day task', async () => {
        const user = await createUser('Europe/Berlin');
        // DTSTART;VALUE=DATE:20261017 with DUE;VALUE=DATE:20261017.
        const imported = await createTask(user, {
            due_date: new Date(BERLIN_DAY_END),
            defer_until: new Date(BERLIN_DAY_START),
            due_has_time: false,
            priority: 0,
        });

        await runUp();

        await imported.reload();
        expect(imported.defer_until).toBeNull();
        expect(imported.due_date.toISOString()).toBe(BERLIN_DAY_END);
    });

    it('clears a defer date that is the same instant as a whole-day due date', async () => {
        const user = await createUser('Europe/Berlin');
        // A timed DTSTART equal to DUE, which the importer stored on both.
        const imported = await createTask(user, {
            due_date: new Date('2026-10-16T09:00:00.000Z'),
            defer_until: new Date('2026-10-16T09:00:00.000Z'),
            due_has_time: false,
        });

        await runUp();

        await imported.reload();
        expect(imported.defer_until).toBeNull();
        expect(imported.due_date.toISOString()).toBe(
            '2026-10-16T09:00:00.000Z'
        );
    });

    it('keeps a defer date that is an earlier day', async () => {
        const user = await createUser('Europe/Berlin');
        const deferred = await createTask(user, {
            due_date: new Date(BERLIN_DAY_END),
            defer_until: new Date(BERLIN_EARLIER_START),
            due_has_time: false,
        });

        await runUp();

        await deferred.reload();
        expect(deferred.defer_until.toISOString()).toBe(BERLIN_EARLIER_START);
    });

    it('keeps a defer date a user picked for a due date that has a time', async () => {
        const user = await createUser('Europe/Berlin');
        // Tududi's own writer sets due_has_time whenever a time is chosen, so
        // this row is not one the importer produced.
        const timed = await createTask(user, {
            due_date: new Date('2026-10-17T08:30:00.000Z'),
            defer_until: new Date('2026-10-17T08:30:00.000Z'),
            due_has_time: true,
        });

        await runUp();

        await timed.reload();
        expect(timed.defer_until.toISOString()).toBe(
            '2026-10-17T08:30:00.000Z'
        );
    });

    it('keeps a defer date that is after the due date', async () => {
        const user = await createUser('Europe/Berlin');
        const later = await createTask(user, {
            due_date: new Date(BERLIN_DAY_END),
            defer_until: new Date('2026-10-20T09:00:00.000Z'),
            due_has_time: false,
        });

        await runUp();

        await later.reload();
        expect(later.defer_until.toISOString()).toBe(
            '2026-10-20T09:00:00.000Z'
        );
    });

    it('reads the due date in the owner timezone rather than UTC', async () => {
        const berlin = await createUser('Europe/Berlin');
        const utc = await createUser('UTC');
        // The same instants describe a whole day in UTC but not in Berlin.
        const utcTask = await createTask(utc, {
            due_date: new Date('2026-10-17T23:59:59.999Z'),
            defer_until: new Date('2026-10-17T00:00:00.000Z'),
            due_has_time: false,
        });
        const berlinTask = await createTask(berlin, {
            due_date: new Date('2026-10-17T23:59:59.999Z'),
            defer_until: new Date('2026-10-17T00:00:00.000Z'),
            due_has_time: false,
        });

        await runUp();

        await utcTask.reload();
        await berlinTask.reload();
        expect(utcTask.defer_until).toBeNull();
        expect(berlinTask.defer_until.toISOString()).toBe(
            '2026-10-17T00:00:00.000Z'
        );
    });

    it('leaves a priority alone, and reports the tasks it cleared', async () => {
        const user = await createUser('Europe/Berlin');
        const imported = await createTask(user, {
            due_date: new Date(BERLIN_DAY_END),
            defer_until: new Date(BERLIN_DAY_START),
            due_has_time: false,
            priority: 0,
        });

        await runUp();

        await imported.reload();
        expect(imported.priority).toBe(0);
        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log.mock.calls[0][0]).toBe(
            `Cleared the CalDAV defer date on 1 task(s): ${imported.id}`
        );
    });

    it('writes nothing and logs nothing when no row matches', async () => {
        const user = await createUser('Europe/Berlin');
        const plain = await createTask(user, {
            due_date: new Date(BERLIN_DAY_END),
            due_has_time: false,
        });

        await runUp();

        await plain.reload();
        expect(plain.defer_until).toBeNull();
        expect(console.log).not.toHaveBeenCalled();
    });
});
