const moment = require('moment-timezone');
const {
    calculateWeeklyRecurrence,
    calculateVirtualOccurrences,
} = require('../../../../modules/tasks/recurringTaskService');

describe('RecurringTaskService - Weekly Recurrence Timezone Awareness (issue #1415)', () => {
    describe('calculateVirtualOccurrences - Mon-Fri weekdays', () => {
        it('never generates a weekend occurrence for a positive-UTC-offset timezone (Asia/Tokyo)', () => {
            const tz = 'Asia/Tokyo';
            // Friday local midnight in Tokyo -> UTC instant is still Thursday,
            // the exact condition that used to corrupt the "last weekday" check.
            const fridayLocal = moment
                .tz('2026-08-28', tz)
                .startOf('day')
                .toDate();
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekdays: [1, 2, 3, 4, 5],
            };

            const occurrences = calculateVirtualOccurrences(
                task,
                10,
                fridayLocal,
                tz
            );

            expect(occurrences).toHaveLength(10);
            occurrences.forEach((occurrence) => {
                const localWeekday = moment.tz(occurrence.due_date, tz).day();
                expect(localWeekday).toBeGreaterThanOrEqual(1);
                expect(localWeekday).toBeLessThanOrEqual(5);
            });
        });

        it('does not skip Monday after a Friday occurrence (Asia/Tokyo)', () => {
            const tz = 'Asia/Tokyo';
            const fridayLocal = moment
                .tz('2026-08-28', tz)
                .startOf('day')
                .toDate();
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekdays: [1, 2, 3, 4, 5],
            };

            const occurrences = calculateVirtualOccurrences(
                task,
                2,
                fridayLocal,
                tz
            );

            expect(occurrences[0].due_date).toBe('2026-08-28'); // Friday
            expect(occurrences[1].due_date).toBe('2026-08-31'); // Monday
        });
    });

    describe('calculateVirtualOccurrences - single weekday ("Repeat on")', () => {
        it('lands on the configured weekday, not the day after, for Europe/Berlin', () => {
            const tz = 'Europe/Berlin';
            const mondayLocal = moment
                .tz('2026-08-31', tz)
                .startOf('day')
                .toDate();
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 1, // Monday
            };

            const occurrences = calculateVirtualOccurrences(
                task,
                5,
                mondayLocal,
                tz
            );

            occurrences.forEach((occurrence) => {
                expect(moment.tz(occurrence.due_date, tz).day()).toBe(1);
            });
        });
    });

    describe('calculateWeeklyRecurrence - UTC default remains unchanged (regression guard)', () => {
        // These mirror existing assertions in recurringTaskService.test.js to lock
        // in that passing no timezone (or 'UTC') is a byte-for-byte no-op.
        it('matches prior UTC-only behavior for multi-weekday pattern', () => {
            const friday = new Date(Date.UTC(2026, 0, 16, 0, 0, 0, 0)); // Friday
            const weekdays = [1, 3, 5];
            const result = calculateWeeklyRecurrence(friday, 1, null, weekdays);

            expect(result.getUTCDay()).toBe(1);
        });

        it('matches prior UTC-only behavior for single weekday', () => {
            const monday = new Date(Date.UTC(2026, 0, 12, 0, 0, 0, 0)); // Monday
            const result = calculateWeeklyRecurrence(monday, 2, 1, null);

            expect(result.getUTCDay()).toBe(1);
            expect(result.getUTCDate()).toBe(26);
        });
    });
});
