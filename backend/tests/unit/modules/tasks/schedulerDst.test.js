const cron = require('node-cron');

// Issue #2085: with the process in Europe/Berlin and the job in UTC, the
// next match must keep moving forward across the October DST change.
// node-cron 4.1.x went from 01:00Z back to 00:05Z, and its missed-execution
// catch-up loop then spun on the same slots until the process ran out of memory.
describe('scheduler next match across DST', () => {
    const originalTz = process.env.TZ;
    let task;

    beforeAll(() => {
        process.env.TZ = 'Europe/Berlin';
    });

    afterEach(() => {
        if (task) task.destroy();
        task = null;
    });

    afterAll(() => {
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
    });

    it.each([['*/5 * * * *'], ['0 * * * *'], ['0 7 * * *']])(
        '%s in UTC advances through the autumn change',
        (expression) => {
            task = cron.createTask(expression, () => {}, { timezone: 'UTC' });

            let current = new Date('2026-10-24T22:50:00Z');
            for (let i = 0; i < 40; i += 1) {
                const next = task.timeMatcher.getNextMatch(current);
                expect(next.getTime()).toBeGreaterThan(current.getTime());
                current = next;
            }
        }
    );
});
