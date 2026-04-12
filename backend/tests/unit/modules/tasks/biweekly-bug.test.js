const {
    calculateWeeklyRecurrence,
    calculateVirtualOccurrences,
} = require('../../../../modules/tasks/recurringTaskService');

describe('Bug #1004 - Bi-weekly recurrence with weekend days', () => {
    describe('Saturday + Sunday pattern', () => {
        it('should correctly schedule every 2 weeks on Saturday and Sunday', () => {
            const saturday = new Date(Date.UTC(2026, 3, 11, 0, 0, 0, 0));
            const weekdays = [0, 6];

            const firstNext = calculateWeeklyRecurrence(
                saturday,
                2,
                null,
                weekdays
            );
            expect(firstNext.getUTCDate()).toBe(12);
            expect(firstNext.getUTCDay()).toBe(0);

            const secondNext = calculateWeeklyRecurrence(
                firstNext,
                2,
                null,
                weekdays
            );
            expect(secondNext.getUTCDate()).toBe(25);
            expect(secondNext.getUTCDay()).toBe(6);

            const thirdNext = calculateWeeklyRecurrence(
                secondNext,
                2,
                null,
                weekdays
            );
            expect(thirdNext.getUTCDate()).toBe(26);
            expect(thirdNext.getUTCDay()).toBe(0);
        });

        it('should generate correct virtual occurrences for bi-weekly weekend pattern', () => {
            const task = {
                due_date: new Date(Date.UTC(2026, 3, 11, 0, 0, 0, 0)),
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekdays: [0, 6],
            };

            const occurrences = calculateVirtualOccurrences(task, 6);

            const dates = occurrences.map((o) =>
                new Date(o.due_date).getUTCDate()
            );
            const days = occurrences.map((o) =>
                new Date(o.due_date).getUTCDay()
            );

            expect(dates).toEqual([11, 12, 25, 26, 9, 10]);
            expect(days).toEqual([6, 0, 6, 0, 6, 0]);
        });

        it('should work when starting from Sunday', () => {
            const sunday = new Date(Date.UTC(2026, 3, 12, 0, 0, 0, 0));
            const weekdays = [0, 6];

            const firstNext = calculateWeeklyRecurrence(
                sunday,
                2,
                null,
                weekdays
            );
            expect(firstNext.getUTCDate()).toBe(25);
            expect(firstNext.getUTCDay()).toBe(6);

            const secondNext = calculateWeeklyRecurrence(
                firstNext,
                2,
                null,
                weekdays
            );
            expect(secondNext.getUTCDate()).toBe(26);
            expect(secondNext.getUTCDay()).toBe(0);
        });
    });

    describe('Other multi-day patterns with interval > 1', () => {
        it('should handle Tuesday + Thursday every 2 weeks', () => {
            const tuesday = new Date(Date.UTC(2026, 3, 14, 0, 0, 0, 0));
            const weekdays = [2, 4];

            const firstNext = calculateWeeklyRecurrence(
                tuesday,
                2,
                null,
                weekdays
            );
            expect(firstNext.getUTCDay()).toBe(4);
            expect(firstNext.getUTCDate()).toBe(16);

            const secondNext = calculateWeeklyRecurrence(
                firstNext,
                2,
                null,
                weekdays
            );
            expect(secondNext.getUTCDay()).toBe(2);
            expect(secondNext.getUTCDate()).toBe(28);
        });

        it('should handle Friday + Saturday + Sunday every 3 weeks', () => {
            const friday = new Date(Date.UTC(2026, 3, 10, 0, 0, 0, 0));
            const weekdays = [0, 5, 6];

            const occurrences = [friday];
            let current = friday;
            for (let i = 0; i < 8; i++) {
                current = calculateWeeklyRecurrence(current, 3, null, weekdays);
                occurrences.push(current);
            }

            const days = occurrences.map((d) => d.getUTCDay());
            expect(days).toEqual([5, 6, 0, 5, 6, 0, 5, 6, 0]);

            const dates = occurrences.map((d) => d.getUTCDate());
            expect(dates).toEqual([10, 11, 12, 1, 2, 3, 22, 23, 24]);
        });
    });
});
