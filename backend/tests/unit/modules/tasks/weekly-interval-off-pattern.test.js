const {
    calculateNextDueDate,
    calculateWeeklyRecurrence,
} = require('../../../../modules/tasks/recurringTaskService');

const day = (date) => date.toISOString().slice(0, 10);

describe('Weekly interval when the start day is not a picked weekday', () => {
    const monday = new Date(Date.UTC(2026, 10, 16, 15, 0, 0, 0));

    it('waits 13 weeks when completed on Monday with Saturday picked', () => {
        const next = calculateNextDueDate(
            {
                recurrence_type: 'weekly',
                recurrence_interval: 13,
                recurrence_weekdays: [6],
            },
            monday,
            'UTC'
        );

        expect(day(next)).toBe('2027-02-13');
    });

    it('matches the single weekday field for the same pattern', () => {
        const single = calculateWeeklyRecurrence(monday, 13, 6, null);
        const multi = calculateWeeklyRecurrence(monday, 13, null, [6]);

        expect(day(multi)).toBe(day(single));
    });

    it('applies the interval with several weekdays picked', () => {
        const wednesday = new Date(Date.UTC(2026, 10, 18, 15, 0, 0, 0));

        const next = calculateWeeklyRecurrence(wednesday, 2, null, [2, 4]);

        expect(day(next)).toBe('2026-11-26');
    });

    it('applies the interval when the next picked weekday is tomorrow', () => {
        const friday = new Date(Date.UTC(2026, 10, 20, 15, 0, 0, 0));

        const next = calculateWeeklyRecurrence(friday, 13, null, [6]);

        expect(day(next)).toBe('2027-02-13');
    });

    it('keeps weekly tasks on the next picked weekday', () => {
        const next = calculateWeeklyRecurrence(monday, 1, null, [6]);

        expect(day(next)).toBe('2026-11-21');
    });

    it('still moves between picked weekdays inside one week', () => {
        const tuesday = new Date(Date.UTC(2026, 10, 17, 15, 0, 0, 0));

        const next = calculateWeeklyRecurrence(tuesday, 2, null, [2, 4]);

        expect(day(next)).toBe('2026-11-19');
    });
});
