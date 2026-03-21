import { formatDateByCountry, formatDateTimeByCountry } from './dateUtils';

describe('formatDateByCountry', () => {
    // Test date: March 15, 2026 at 10:30 AM
    const testDate = new Date('2026-03-15T10:30:00');

    describe('DD/MM/YYYY format (European and most global)', () => {
        it('formats dates in DD/MM/YYYY for Greece', () => {
            expect(formatDateByCountry(testDate, 'GR')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for United Kingdom', () => {
            expect(formatDateByCountry(testDate, 'GB')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for France', () => {
            expect(formatDateByCountry(testDate, 'FR')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for Germany', () => {
            expect(formatDateByCountry(testDate, 'DE')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for Italy', () => {
            expect(formatDateByCountry(testDate, 'IT')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for Spain', () => {
            expect(formatDateByCountry(testDate, 'ES')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for Australia', () => {
            expect(formatDateByCountry(testDate, 'AU')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for India', () => {
            expect(formatDateByCountry(testDate, 'IN')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for Brazil', () => {
            expect(formatDateByCountry(testDate, 'BR')).toBe('15/03/2026');
        });

        it('formats dates in DD/MM/YYYY for South Africa', () => {
            expect(formatDateByCountry(testDate, 'ZA')).toBe('15/03/2026');
        });
    });

    describe('MM/DD/YYYY format (North America)', () => {
        it('formats dates in MM/DD/YYYY for United States', () => {
            expect(formatDateByCountry(testDate, 'US')).toBe('03/15/2026');
        });

        it('formats dates in MM/DD/YYYY for Canada', () => {
            expect(formatDateByCountry(testDate, 'CA')).toBe('03/15/2026');
        });

        it('formats dates in MM/DD/YYYY for Philippines', () => {
            expect(formatDateByCountry(testDate, 'PH')).toBe('03/15/2026');
        });
    });

    describe('YYYY/MM/DD format (East Asia)', () => {
        it('formats dates in YYYY/MM/DD for Japan', () => {
            expect(formatDateByCountry(testDate, 'JP')).toBe('2026/03/15');
        });

        it('formats dates in YYYY/MM/DD for South Korea', () => {
            expect(formatDateByCountry(testDate, 'KR')).toBe('2026/03/15');
        });

        it('formats dates in YYYY/MM/DD for China', () => {
            expect(formatDateByCountry(testDate, 'CN')).toBe('2026/03/15');
        });

        it('formats dates in YYYY/MM/DD for Taiwan', () => {
            expect(formatDateByCountry(testDate, 'TW')).toBe('2026/03/15');
        });
    });

    describe('Default and edge cases', () => {
        it('uses DD/MM/YYYY as default format when country is null', () => {
            expect(formatDateByCountry(testDate, null)).toBe('15/03/2026');
        });

        it('uses DD/MM/YYYY as default format when country is undefined', () => {
            expect(formatDateByCountry(testDate, undefined)).toBe('15/03/2026');
        });

        it('uses DD/MM/YYYY as default format when country is unknown', () => {
            expect(formatDateByCountry(testDate, 'UNKNOWN')).toBe('15/03/2026');
        });

        it('uses DD/MM/YYYY as default format for empty string', () => {
            expect(formatDateByCountry(testDate, '')).toBe('15/03/2026');
        });
    });

    describe('Date boundaries', () => {
        it('formats dates with single-digit day correctly', () => {
            const date = new Date('2026-03-05T10:00:00');
            expect(formatDateByCountry(date, 'GR')).toBe('05/03/2026');
            expect(formatDateByCountry(date, 'US')).toBe('03/05/2026');
            expect(formatDateByCountry(date, 'JP')).toBe('2026/03/05');
        });

        it('formats dates with single-digit month correctly', () => {
            const date = new Date('2026-01-15T10:00:00');
            expect(formatDateByCountry(date, 'GR')).toBe('15/01/2026');
            expect(formatDateByCountry(date, 'US')).toBe('01/15/2026');
            expect(formatDateByCountry(date, 'JP')).toBe('2026/01/15');
        });

        it('formats end of month dates correctly', () => {
            const date = new Date('2026-12-31T10:00:00');
            expect(formatDateByCountry(date, 'GR')).toBe('31/12/2026');
            expect(formatDateByCountry(date, 'US')).toBe('12/31/2026');
            expect(formatDateByCountry(date, 'JP')).toBe('2026/12/31');
        });

        it('formats start of year dates correctly', () => {
            const date = new Date('2026-01-01T10:00:00');
            expect(formatDateByCountry(date, 'GR')).toBe('01/01/2026');
            expect(formatDateByCountry(date, 'US')).toBe('01/01/2026');
            expect(formatDateByCountry(date, 'JP')).toBe('2026/01/01');
        });
    });
});

describe('formatDateTimeByCountry', () => {
    // Test datetime: March 15, 2026 at 14:30 (2:30 PM)
    const testDate = new Date('2026-03-15T14:30:00');

    describe('DD/MM/YYYY HH:MM format (European and most global)', () => {
        it('formats datetime in DD/MM/YYYY HH:MM for Greece', () => {
            expect(formatDateTimeByCountry(testDate, 'GR')).toBe(
                '15/03/2026 14:30'
            );
        });

        it('formats datetime in DD/MM/YYYY HH:MM for United Kingdom', () => {
            expect(formatDateTimeByCountry(testDate, 'GB')).toBe(
                '15/03/2026 14:30'
            );
        });

        it('formats datetime in DD/MM/YYYY HH:MM for Germany', () => {
            expect(formatDateTimeByCountry(testDate, 'DE')).toBe(
                '15/03/2026 14:30'
            );
        });

        it('formats datetime in DD/MM/YYYY HH:MM for Australia', () => {
            expect(formatDateTimeByCountry(testDate, 'AU')).toBe(
                '15/03/2026 14:30'
            );
        });
    });

    describe('MM/DD/YYYY HH:MM format (North America)', () => {
        it('formats datetime in MM/DD/YYYY HH:MM for United States', () => {
            expect(formatDateTimeByCountry(testDate, 'US')).toBe(
                '03/15/2026 14:30'
            );
        });

        it('formats datetime in MM/DD/YYYY HH:MM for Canada', () => {
            expect(formatDateTimeByCountry(testDate, 'CA')).toBe(
                '03/15/2026 14:30'
            );
        });
    });

    describe('YYYY/MM/DD HH:MM format (East Asia)', () => {
        it('formats datetime in YYYY/MM/DD HH:MM for Japan', () => {
            expect(formatDateTimeByCountry(testDate, 'JP')).toBe(
                '2026/03/15 14:30'
            );
        });

        it('formats datetime in YYYY/MM/DD HH:MM for South Korea', () => {
            expect(formatDateTimeByCountry(testDate, 'KR')).toBe(
                '2026/03/15 14:30'
            );
        });

        it('formats datetime in YYYY/MM/DD HH:MM for China', () => {
            expect(formatDateTimeByCountry(testDate, 'CN')).toBe(
                '2026/03/15 14:30'
            );
        });
    });

    describe('Time formatting', () => {
        it('uses 24-hour format for all countries', () => {
            const morning = new Date('2026-03-15T09:15:00');
            const afternoon = new Date('2026-03-15T15:45:00');
            const midnight = new Date('2026-03-15T00:00:00');
            const noon = new Date('2026-03-15T12:00:00');

            expect(formatDateTimeByCountry(morning, 'US')).toBe(
                '03/15/2026 09:15'
            );
            expect(formatDateTimeByCountry(afternoon, 'US')).toBe(
                '03/15/2026 15:45'
            );
            expect(formatDateTimeByCountry(midnight, 'US')).toBe(
                '03/15/2026 00:00'
            );
            expect(formatDateTimeByCountry(noon, 'US')).toBe(
                '03/15/2026 12:00'
            );
        });

        it('formats minutes with leading zero', () => {
            const date = new Date('2026-03-15T14:05:00');
            expect(formatDateTimeByCountry(date, 'GR')).toBe(
                '15/03/2026 14:05'
            );
        });

        it('formats hours with leading zero for single digits', () => {
            const date = new Date('2026-03-15T08:30:00');
            expect(formatDateTimeByCountry(date, 'GR')).toBe(
                '15/03/2026 08:30'
            );
        });
    });

    describe('Default and edge cases', () => {
        it('uses DD/MM/YYYY HH:MM as default format when country is null', () => {
            expect(formatDateTimeByCountry(testDate, null)).toBe(
                '15/03/2026 14:30'
            );
        });

        it('uses DD/MM/YYYY HH:MM as default format when country is undefined', () => {
            expect(formatDateTimeByCountry(testDate, undefined)).toBe(
                '15/03/2026 14:30'
            );
        });

        it('uses DD/MM/YYYY HH:MM as default format when country is unknown', () => {
            expect(formatDateTimeByCountry(testDate, 'UNKNOWN')).toBe(
                '15/03/2026 14:30'
            );
        });
    });
});
