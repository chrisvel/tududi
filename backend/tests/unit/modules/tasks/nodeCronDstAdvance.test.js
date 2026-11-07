/**
 * Regression for chrisvel/tududi#2085:
 * node-cron 4.1.x TimeMatcher can move backwards across Europe/Berlin autumn DST
 * even when the cron timezone is UTC (as used by deferred_tasks).
 */
'use strict';

const assert = require('node:assert/strict');
const cron = require('node-cron');

describe('node-cron DST advance (issue #2085)', () => {
    const previousTz = process.env.TZ;

    afterAll(() => {
        if (previousTz === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = previousTz;
        }
    });

    it('getNextMatch advances across Europe/Berlin autumn DST with UTC cron tz', () => {
        process.env.TZ = 'Europe/Berlin';
        const task = cron.schedule('*/5 * * * *', () => {}, {
            timezone: 'UTC',
            scheduled: false,
        });
        assert.ok(
            task &&
                task.timeMatcher &&
                typeof task.timeMatcher.getNextMatch === 'function',
            'node-cron schedule() should expose timeMatcher.getNextMatch'
        );
        let current = new Date('2026-10-25T00:50:00Z');
        for (let i = 0; i < 20; i += 1) {
            const next = task.timeMatcher.getNextMatch(current);
            assert.ok(
                next > current,
                `next execution must advance: ${current.toISOString()} -> ${
                    next && next.toISOString()
                }`
            );
            current = next;
        }
        if (typeof task.destroy === 'function') {
            task.destroy();
        }
    });
});
