const { parseRRULE } = require('../../../../../modules/caldav/icalendar/rrule-parser');

describe('RRULE Parser', () => {
    it('should return null for empty RRULE', () => {
        expect(parseRRULE('')).toBeNull();
        expect(parseRRULE(null)).toBeNull();
    });

    it('should return null for RRULE without FREQ', () => {
        expect(parseRRULE('INTERVAL=2')).toBeNull();
    });

    describe('Daily Recurrence', () => {
        it('should parse daily RRULE', () => {
            const result = parseRRULE('FREQ=DAILY');
            expect(result.recurrence_type).toBe('daily');
            expect(result.recurrence_interval).toBe(1);
        });

        it('should parse daily with interval', () => {
            const result = parseRRULE('FREQ=DAILY;INTERVAL=3');
            expect(result.recurrence_type).toBe('daily');
            expect(result.recurrence_interval).toBe(3);
        });
    });

    describe('Weekly Recurrence', () => {
        it('should parse weekly RRULE', () => {
            const result = parseRRULE('FREQ=WEEKLY');
            expect(result.recurrence_type).toBe('weekly');
            expect(result.recurrence_interval).toBe(1);
        });

        it('should parse weekly with BYDAY', () => {
            const result = parseRRULE('FREQ=WEEKLY;BYDAY=MO,WE,FR');
            expect(result.recurrence_type).toBe('weekly');
            expect(result.recurrence_weekdays).toEqual([1, 3, 5]);
        });

        it('should parse weekly with interval and BYDAY', () => {
            const result = parseRRULE('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH');
            expect(result.recurrence_type).toBe('weekly');
            expect(result.recurrence_interval).toBe(2);
            expect(result.recurrence_weekdays).toEqual([2, 4]);
        });
    });

    describe('Monthly Recurrence', () => {
        it('should parse monthly with BYMONTHDAY', () => {
            const result = parseRRULE('FREQ=MONTHLY;BYMONTHDAY=15');
            expect(result.recurrence_type).toBe('monthly');
            expect(result.recurrence_month_day).toBe(15);
        });

        it('should parse monthly last day', () => {
            const result = parseRRULE('FREQ=MONTHLY;BYMONTHDAY=-1');
            expect(result.recurrence_type).toBe('monthly_last_day');
        });

        it('should parse monthly weekday (2nd Thursday)', () => {
            const result = parseRRULE('FREQ=MONTHLY;BYDAY=2TH');
            expect(result.recurrence_type).toBe('monthly_weekday');
            expect(result.recurrence_week_of_month).toBe(2);
            expect(result.recurrence_weekday).toBe(4);
        });

        it('should parse monthly weekday (last Friday)', () => {
            const result = parseRRULE('FREQ=MONTHLY;BYDAY=-1FR');
            expect(result.recurrence_type).toBe('monthly_weekday');
            expect(result.recurrence_week_of_month).toBe(-1);
            expect(result.recurrence_weekday).toBe(5);
        });

        it('should parse monthly with interval', () => {
            const result = parseRRULE('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=10');
            expect(result.recurrence_type).toBe('monthly');
            expect(result.recurrence_interval).toBe(3);
            expect(result.recurrence_month_day).toBe(10);
        });
    });

    describe('Yearly Recurrence', () => {
        it('should parse yearly RRULE', () => {
            const result = parseRRULE('FREQ=YEARLY');
            expect(result.recurrence_type).toBe('yearly');
            expect(result.recurrence_interval).toBe(1);
        });

        it('should parse yearly with interval', () => {
            const result = parseRRULE('FREQ=YEARLY;INTERVAL=2');
            expect(result.recurrence_type).toBe('yearly');
            expect(result.recurrence_interval).toBe(2);
        });
    });

    describe('UNTIL (End Date)', () => {
        it('should parse UNTIL date', () => {
            const result = parseRRULE('FREQ=DAILY;UNTIL=20261231T120000Z');
            expect(result.recurrence_type).toBe('daily');
            expect(result.recurrence_end_date).toBeInstanceOf(Date);
            expect(result.recurrence_end_date.getFullYear()).toBe(2026);
            expect(result.recurrence_end_date.getMonth()).toBe(11);
            expect(result.recurrence_end_date.getDate()).toBe(31);
        });

        it('should parse weekly with BYDAY and UNTIL', () => {
            const result = parseRRULE('FREQ=WEEKLY;BYDAY=MO,FR;UNTIL=20270101T000000Z');
            expect(result.recurrence_type).toBe('weekly');
            expect(result.recurrence_weekdays).toEqual([1, 5]);
            expect(result.recurrence_end_date).toBeInstanceOf(Date);
        });
    });

    describe('Round-trip compatibility', () => {
        const testCases = [
            { rrule: 'FREQ=DAILY', type: 'daily' },
            { rrule: 'FREQ=DAILY;INTERVAL=2', type: 'daily', interval: 2 },
            { rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR', type: 'weekly', weekdays: [1, 3, 5] },
            { rrule: 'FREQ=MONTHLY;BYMONTHDAY=15', type: 'monthly', monthDay: 15 },
            { rrule: 'FREQ=MONTHLY;BYMONTHDAY=-1', type: 'monthly_last_day' },
            { rrule: 'FREQ=MONTHLY;BYDAY=2TH', type: 'monthly_weekday', week: 2, weekday: 4 },
            { rrule: 'FREQ=YEARLY', type: 'yearly' },
        ];

        testCases.forEach(({ rrule, type }) => {
            it(`should parse ${type} RRULE correctly`, () => {
                const result = parseRRULE(rrule);
                expect(result).not.toBeNull();
                expect(result.recurrence_type).toBe(type);
            });
        });
    });
});
