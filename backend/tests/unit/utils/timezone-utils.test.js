const {
    dateStringToUTC,
    utcToUserDateString,
    getCurrentDateInTimezone,
    getDayBoundsInUTC,
    getTodayBoundsInUTC,
    getUpcomingRangeInUTC,
    isToday,
    isOverdue,
    processDueDateForStorage,
    processDueDateForResponse,
    isValidTimezone,
    getSafeTimezone,
} = require('../../../utils/timezone-utils');
const moment = require('moment-timezone');

describe('timezone-utils', () => {
    // Mock current time for consistent testing
    const MOCK_DATE = '2024-01-15T12:00:00Z'; // Monday, Jan 15, 2024 at noon UTC

    beforeEach(() => {
        // Mock current time
        jest.useFakeTimers();
        jest.setSystemTime(new Date(MOCK_DATE));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('dateStringToUTC', () => {
        it('should convert date string to UTC at start of day', () => {
            const result = dateStringToUTC(
                '2024-01-15',
                'America/New_York',
                'start'
            );

            // 2024-01-15 00:00:00 in EST is 2024-01-15 05:00:00 UTC (EST is UTC-5)
            expect(result).toEqual(new Date('2024-01-15T05:00:00.000Z'));
        });

        it('should convert date string to UTC at end of day', () => {
            const result = dateStringToUTC(
                '2024-01-15',
                'America/New_York',
                'end'
            );

            // 2024-01-15 23:59:59.999 in EST is 2024-01-16 04:59:59.999 UTC
            expect(result.toISOString()).toBe('2024-01-16T04:59:59.999Z');
        });

        it('should handle Pacific timezone', () => {
            const result = dateStringToUTC(
                '2024-01-15',
                'America/Los_Angeles',
                'start'
            );

            // 2024-01-15 00:00:00 in PST is 2024-01-15 08:00:00 UTC (PST is UTC-8)
            expect(result).toEqual(new Date('2024-01-15T08:00:00.000Z'));
        });

        it('should handle UTC timezone', () => {
            const result = dateStringToUTC('2024-01-15', 'UTC', 'start');
            expect(result).toEqual(new Date('2024-01-15T00:00:00.000Z'));
        });

        it('should return null for empty date string', () => {
            expect(dateStringToUTC('', 'America/New_York')).toBeNull();
            expect(dateStringToUTC(null, 'America/New_York')).toBeNull();
            expect(dateStringToUTC(undefined, 'America/New_York')).toBeNull();
        });
    });

    describe('utcToUserDateString', () => {
        it('should convert UTC date to user timezone date string', () => {
            const utcDate = new Date('2024-01-15T05:00:00.000Z'); // This is midnight EST
            const result = utcToUserDateString(utcDate, 'America/New_York');
            expect(result).toBe('2024-01-15');
        });

        it('should handle timezone boundary crossing', () => {
            const utcDate = new Date('2024-01-15T04:00:00.000Z'); // This is 11 PM previous day EST
            const result = utcToUserDateString(utcDate, 'America/New_York');
            expect(result).toBe('2024-01-14');
        });

        it('should return null for null input', () => {
            expect(utcToUserDateString(null, 'America/New_York')).toBeNull();
        });
    });

    describe('getCurrentDateInTimezone', () => {
        it('should get current date in specified timezone', () => {
            // Mock date is 2024-01-15T12:00:00Z (noon UTC)
            // In EST (UTC-5), this is 7 AM on Jan 15, 2024
            const result = getCurrentDateInTimezone('America/New_York');
            expect(result).toBe('2024-01-15');
        });

        it('should handle different timezone results', () => {
            // In Tokyo (UTC+9), noon UTC is 9 PM same day
            const result = getCurrentDateInTimezone('Asia/Tokyo');
            expect(result).toBe('2024-01-15');
        });

        it('should handle UTC', () => {
            const result = getCurrentDateInTimezone('UTC');
            expect(result).toBe('2024-01-15');
        });
    });

    describe('getDayBoundsInUTC', () => {
        it('should get day bounds in UTC', () => {
            const result = getDayBoundsInUTC('2024-01-15', 'America/New_York');

            expect(result.start).toEqual(new Date('2024-01-15T05:00:00.000Z'));
            expect(result.end.toISOString()).toBe('2024-01-16T04:59:59.999Z');
        });

        it('should return null for empty date', () => {
            const result = getDayBoundsInUTC('', 'America/New_York');
            expect(result).toBeNull();
        });
    });

    describe('getTodayBoundsInUTC', () => {
        it('should get today bounds in user timezone', () => {
            const result = getTodayBoundsInUTC('America/New_York');

            // Today in EST is 2024-01-15, so bounds should be start/end of that day in UTC
            expect(result.start).toEqual(new Date('2024-01-15T05:00:00.000Z'));
            expect(result.end.toISOString()).toBe('2024-01-16T04:59:59.999Z');
        });
    });

    describe('getUpcomingRangeInUTC', () => {
        it('should get upcoming 7 days range by default', () => {
            const result = getUpcomingRangeInUTC('America/New_York');

            // Should start from today (2024-01-15) and go 7 days ahead
            expect(result.start).toEqual(new Date('2024-01-15T05:00:00.000Z'));
            // 7 days from Jan 15 is Jan 22, end of day in EST
            expect(result.end.toISOString()).toBe('2024-01-23T04:59:59.999Z');
        });

        it('should handle custom day count', () => {
            const result = getUpcomingRangeInUTC('America/New_York', 3);

            expect(result.start).toEqual(new Date('2024-01-15T05:00:00.000Z'));
            // 3 days from Jan 15 is Jan 18, end of day in EST
            expect(result.end.toISOString()).toBe('2024-01-19T04:59:59.999Z');
        });
    });

    describe('isToday', () => {
        it('should return true for today in user timezone', () => {
            // A date that falls on Jan 15 in EST
            const utcDate = new Date('2024-01-15T10:00:00.000Z'); // 5 AM EST
            const result = isToday(utcDate, 'America/New_York');
            expect(result).toBe(true);
        });

        it('should return false for different day in user timezone', () => {
            // A date that falls on Jan 14 in EST (but Jan 15 in UTC)
            const utcDate = new Date('2024-01-15T03:00:00.000Z'); // 10 PM EST previous day
            const result = isToday(utcDate, 'America/New_York');
            expect(result).toBe(false);
        });

        it('should return false for null date', () => {
            expect(isToday(null, 'America/New_York')).toBe(false);
        });
    });

    describe('isOverdue', () => {
        it('should return true for dates before today', () => {
            const utcDate = new Date('2024-01-14T12:00:00.000Z');
            const result = isOverdue(utcDate, 'America/New_York');
            expect(result).toBe(true);
        });

        it('should return false for today', () => {
            const utcDate = new Date('2024-01-15T10:00:00.000Z'); // Jan 15 in EST
            const result = isOverdue(utcDate, 'America/New_York');
            expect(result).toBe(false);
        });

        it('should return false for future dates', () => {
            const utcDate = new Date('2024-01-16T12:00:00.000Z');
            const result = isOverdue(utcDate, 'America/New_York');
            expect(result).toBe(false);
        });

        it('should return false for null date', () => {
            expect(isOverdue(null, 'America/New_York')).toBe(false);
        });
    });

    describe('processDueDateForStorage', () => {
        it('should convert due date to UTC for storage', () => {
            const result = processDueDateForStorage(
                '2024-01-15',
                'America/New_York'
            );

            // Should be end of day in EST converted to UTC
            expect(result.toISOString()).toBe('2024-01-16T04:59:59.999Z');
        });

        it('should return null for empty date', () => {
            expect(processDueDateForStorage('', 'America/New_York')).toBeNull();
            expect(
                processDueDateForStorage(null, 'America/New_York')
            ).toBeNull();
            expect(
                processDueDateForStorage('  ', 'America/New_York')
            ).toBeNull();
        });
    });

    describe('processDueDateForResponse', () => {
        it('should convert UTC due date to user timezone string', () => {
            const utcDate = new Date('2024-01-16T04:59:59.999Z'); // End of Jan 15 in EST
            const result = processDueDateForResponse(
                utcDate,
                'America/New_York'
            );
            expect(result).toBe('2024-01-15');
        });

        it('should return null for null date', () => {
            expect(
                processDueDateForResponse(null, 'America/New_York')
            ).toBeNull();
        });
    });

    describe('isValidTimezone', () => {
        it('should return true for valid timezones', () => {
            expect(isValidTimezone('America/New_York')).toBe(true);
            expect(isValidTimezone('UTC')).toBe(true);
            expect(isValidTimezone('Europe/London')).toBe(true);
            expect(isValidTimezone('Asia/Tokyo')).toBe(true);
        });

        it('should return false for invalid timezones', () => {
            expect(isValidTimezone('Invalid/Timezone')).toBe(false);
            expect(isValidTimezone('')).toBe(false);
            expect(isValidTimezone(null)).toBe(false);
            expect(isValidTimezone(undefined)).toBe(false);
            expect(isValidTimezone(123)).toBe(false);
        });
    });

    describe('getSafeTimezone', () => {
        it('should return valid timezone as-is', () => {
            expect(getSafeTimezone('America/New_York')).toBe(
                'America/New_York'
            );
        });

        it('should return UTC for invalid timezone', () => {
            expect(getSafeTimezone('Invalid/Timezone')).toBe('UTC');
            expect(getSafeTimezone('')).toBe('UTC');
            expect(getSafeTimezone(null)).toBe('UTC');
        });
    });

    describe('DST transition handling', () => {
        beforeEach(() => {
            // Set time to during DST transition period
            jest.setSystemTime(new Date('2024-03-10T12:00:00Z')); // DST starts March 10, 2024
        });

        it('should handle DST spring forward correctly', () => {
            // In 2024, DST starts March 10 at 2 AM (becomes 3 AM)
            // Before DST (EST is UTC-5), After DST (EDT is UTC-4)
            const result = dateStringToUTC(
                '2024-03-10',
                'America/New_York',
                'start'
            );
            // March 10 at midnight should still be EST (UTC-5)
            expect(result).toEqual(new Date('2024-03-10T05:00:00.000Z'));
        });

        it('should handle fall back correctly', () => {
            jest.setSystemTime(new Date('2024-11-03T12:00:00Z')); // DST ends November 3, 2024

            const result = dateStringToUTC(
                '2024-11-03',
                'America/New_York',
                'start'
            );
            // November 3 at 2 AM becomes 1 AM (fall back to EST)
            // At midnight, it should still be EDT (UTC-4)
            expect(result).toEqual(new Date('2024-11-03T04:00:00.000Z'));
        });
    });

    describe('edge cases', () => {
        it('should handle leap year dates', () => {
            const result = dateStringToUTC(
                '2024-02-29',
                'America/New_York',
                'start'
            );
            expect(result).toEqual(new Date('2024-02-29T05:00:00.000Z'));
        });

        it('should handle year boundaries', () => {
            const result = dateStringToUTC(
                '2024-01-01',
                'America/New_York',
                'start'
            );
            expect(result).toEqual(new Date('2024-01-01T05:00:00.000Z'));
        });

        it('should handle international date line', () => {
            // Date in Samoa (UTC+13)
            const result = dateStringToUTC(
                '2024-01-15',
                'Pacific/Apia',
                'start'
            );
            // Samoa is 13 hours ahead of UTC
            expect(result).toEqual(new Date('2024-01-14T11:00:00.000Z'));
        });
    });
});
