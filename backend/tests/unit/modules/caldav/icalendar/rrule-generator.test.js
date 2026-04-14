const { generateRRULE } = require('../../../../../modules/caldav/icalendar/rrule-generator');

describe('RRULE Generator', () => {
    it('should return null for non-recurring task', () => {
        const task = { recurrence_type: 'none' };
        expect(generateRRULE(task)).toBeNull();
    });

    it('should return null for task without recurrence_type', () => {
        const task = {};
        expect(generateRRULE(task)).toBeNull();
    });

    describe('Daily Recurrence', () => {
        it('should generate daily RRULE', () => {
            const task = { recurrence_type: 'daily' };
            expect(generateRRULE(task)).toBe('FREQ=DAILY');
        });

        it('should include interval for daily recurrence', () => {
            const task = { recurrence_type: 'daily', recurrence_interval: 2 };
            expect(generateRRULE(task)).toBe('FREQ=DAILY;INTERVAL=2');
        });

        it('should not include INTERVAL=1', () => {
            const task = { recurrence_type: 'daily', recurrence_interval: 1 };
            expect(generateRRULE(task)).toBe('FREQ=DAILY');
        });
    });

    describe('Weekly Recurrence', () => {
        it('should generate weekly RRULE', () => {
            const task = { recurrence_type: 'weekly' };
            expect(generateRRULE(task)).toBe('FREQ=WEEKLY');
        });

        it('should include BYDAY for specific weekdays', () => {
            const task = {
                recurrence_type: 'weekly',
                recurrence_weekdays: [1, 3, 5],
            };
            expect(generateRRULE(task)).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
        });

        it('should handle weekdays as JSON string', () => {
            const task = {
                recurrence_type: 'weekly',
                recurrence_weekdays: '[1,3,5]',
            };
            expect(generateRRULE(task)).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
        });

        it('should include interval', () => {
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekdays: [1],
            };
            expect(generateRRULE(task)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO');
        });
    });

    describe('Monthly Recurrence', () => {
        it('should generate monthly RRULE with month day', () => {
            const task = {
                recurrence_type: 'monthly',
                recurrence_month_day: 15,
            };
            expect(generateRRULE(task)).toBe('FREQ=MONTHLY;BYMONTHDAY=15');
        });

        it('should include interval', () => {
            const task = {
                recurrence_type: 'monthly',
                recurrence_interval: 3,
                recurrence_month_day: 1,
            };
            expect(generateRRULE(task)).toBe('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1');
        });
    });

    describe('Monthly Weekday Recurrence', () => {
        it('should generate monthly weekday RRULE', () => {
            const task = {
                recurrence_type: 'monthly_weekday',
                recurrence_week_of_month: 2,
                recurrence_weekday: 4,
            };
            expect(generateRRULE(task)).toBe('FREQ=MONTHLY;BYDAY=2TH');
        });

        it('should handle last occurrence (-1)', () => {
            const task = {
                recurrence_type: 'monthly_weekday',
                recurrence_week_of_month: -1,
                recurrence_weekday: 5,
            };
            expect(generateRRULE(task)).toBe('FREQ=MONTHLY;BYDAY=-1FR');
        });
    });

    describe('Monthly Last Day Recurrence', () => {
        it('should generate monthly last day RRULE', () => {
            const task = { recurrence_type: 'monthly_last_day' };
            expect(generateRRULE(task)).toBe('FREQ=MONTHLY;BYMONTHDAY=-1');
        });

        it('should include interval', () => {
            const task = {
                recurrence_type: 'monthly_last_day',
                recurrence_interval: 2,
            };
            expect(generateRRULE(task)).toBe('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1');
        });
    });

    describe('Yearly Recurrence', () => {
        it('should generate yearly RRULE', () => {
            const task = { recurrence_type: 'yearly' };
            expect(generateRRULE(task)).toBe('FREQ=YEARLY');
        });

        it('should include interval', () => {
            const task = { recurrence_type: 'yearly', recurrence_interval: 2 };
            expect(generateRRULE(task)).toBe('FREQ=YEARLY;INTERVAL=2');
        });
    });

    describe('UNTIL (End Date)', () => {
        it('should include UNTIL for end date', () => {
            const task = {
                recurrence_type: 'daily',
                recurrence_end_date: new Date('2026-12-31T23:59:59Z'),
            };
            const rrule = generateRRULE(task);
            expect(rrule).toContain('FREQ=DAILY');
            expect(rrule).toContain('UNTIL=');
        });

        it('should handle end date with weekly recurrence', () => {
            const task = {
                recurrence_type: 'weekly',
                recurrence_weekdays: [1, 5],
                recurrence_end_date: new Date('2027-01-01'),
            };
            const rrule = generateRRULE(task);
            expect(rrule).toContain('FREQ=WEEKLY');
            expect(rrule).toContain('BYDAY=MO,FR');
            expect(rrule).toContain('UNTIL=');
        });
    });
});
