import {
    setLocalePreferences,
    getCalendarSystem,
    resolveDisplayLocale,
    resolveDateLocale,
    formatDisplayDate,
    toPersianParts,
    jalaliToUtcDate,
    lastDayOfEsfand,
    persianMonthLength,
    getEffectiveWeekStart,
    PERSIAN_WEEK_START,
    formatDisplayNumber,
} from '../jalali';

// A fixed ISO instant: 2024-03-20T00:00:00Z (1 Farvardin 1403 per ICU).
const FIXED_ISO = '2024-03-20';
const FIXED_UTC = Date.UTC(2024, 2, 20);

beforeEach(() => {
    setLocalePreferences({ calendarSystem: 'persian', latinDigits: false });
});

describe('calendar_system preference', () => {
    it('is independent from language once set explicitly', () => {
        setLocalePreferences({ calendarSystem: 'gregorian' });
        expect(getCalendarSystem('fa')).toBe('gregorian');
        setLocalePreferences({ calendarSystem: 'persian' });
        expect(getCalendarSystem('en')).toBe('persian');
    });

    it('defaults to persian for fa and gregorian otherwise', () => {
        setLocalePreferences({ calendarSystem: undefined });
        expect(getCalendarSystem('fa')).toBe('persian');
        expect(getCalendarSystem('en')).toBe('gregorian');
    });
});

describe('resolveDisplayLocale', () => {
    it('builds fa-IR with the persian calendar extension', () => {
        expect(resolveDisplayLocale('fa')).toBe('fa-IR-u-ca-persian');
    });

    it('adds the latin digits extension when enabled', () => {
        setLocalePreferences({ latinDigits: true });
        expect(resolveDisplayLocale('fa')).toBe('fa-IR-u-ca-persian-nu-latn');
    });

    it('can attach the persian calendar to en for numbers', () => {
        expect(resolveDisplayLocale('en')).toBe('en-u-ca-persian');
    });

    it('uses Persian month and weekday names for Jalali dates in English', () => {
        expect(resolveDateLocale('en')).toBe('fa-IR-u-ca-persian');
    });
});

describe('formatDisplayDate', () => {
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };

    it('matches a second independent Intl formatter for a fixed ISO date', () => {
        const ours = formatDisplayDate(new Date(FIXED_UTC), options, 'fa');
        const reference = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(new Date(FIXED_UTC));
        expect(ours).toBe(reference);
    });

    it('uses latin digits when the setting is on', () => {
        setLocalePreferences({ latinDigits: true });
        const formatted = formatDisplayDate(new Date(FIXED_UTC), options, 'fa');
        expect(formatted).toMatch(/1403/);
        expect(formatted).not.toMatch(/۱۴۰۳/);
    });

    it('formats with persian digits by default in fa', () => {
        const formatted = formatDisplayDate(new Date(FIXED_UTC), options, 'fa');
        expect(formatted).toMatch(/۱۴۰۳/);
    });

    it('keeps gregorian formatting when calendar_system is gregorian', () => {
        setLocalePreferences({ calendarSystem: 'gregorian' });
        const formatted = formatDisplayDate(new Date(FIXED_UTC), options, 'en');
        expect(formatted).toContain('2024');
        expect(formatted).toContain('March');
    });

    it('shows a Persian month and weekday when the UI language is English', () => {
        const formatted = formatDisplayDate(
            new Date(FIXED_UTC),
            {
                timeZone: 'UTC',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            },
            'en'
        );
        expect(formatted).toContain('فروردین');
        expect(formatted).toContain('چهارشنبه');
    });
});

describe('round trip: picked Jalali day back to the same ISO day', () => {
    it('round-trips a fixed ISO date through Intl parts', () => {
        const parts = toPersianParts(FIXED_UTC);
        const back = jalaliToUtcDate(parts.year, parts.month, parts.day);
        expect(back.toISOString().slice(0, 10)).toBe(FIXED_ISO);
    });

    it('round-trips across the Jalali year boundary', () => {
        // A day deep in Esfand (late in the Jalali year).
        const esfandDay = Date.UTC(2025, 2, 10);
        const parts = toPersianParts(esfandDay);
        expect(parts.month).toBe(12);
        const back = jalaliToUtcDate(parts.year, parts.month, parts.day);
        expect(back.toISOString().slice(0, 10)).toBe(
            new Date(esfandDay).toISOString().slice(0, 10)
        );
    });

    it('round-trips a sample of days across a full year', () => {
        for (let i = 0; i < 370; i += 17) {
            const instant = FIXED_UTC + i * 24 * 60 * 60 * 1000;
            const parts = toPersianParts(instant);
            const back = jalaliToUtcDate(parts.year, parts.month, parts.day);
            expect(back.toISOString().slice(0, 10)).toBe(
                new Date(instant).toISOString().slice(0, 10)
            );
        }
    });
});

describe('Esfand length from ICU (never hardcoded)', () => {
    it('is 29 or 30 and agrees with a direct ICU probe', () => {
        for (const year of [1402, 1403, 1404]) {
            const length = lastDayOfEsfand(year);
            expect([29, 30]).toContain(length);
            // Direct probe: the day after the last of Esfand must be Nowruz.
            const last = jalaliToUtcDate(year, 12, length);
            const next = toPersianParts(last.getTime() + 24 * 60 * 60 * 1000);
            expect(next).toEqual({ year: year + 1, month: 1, day: 1 });
        }
    });

    it('persianMonthLength reads Esfand from ICU', () => {
        expect(persianMonthLength(1403, 1)).toBe(31);
        expect(persianMonthLength(1403, 7)).toBe(30);
        expect(persianMonthLength(1403, 12)).toBe(lastDayOfEsfand(1403));
    });
});

describe('week start', () => {
    it('forces Saturday when the persian calendar is active', () => {
        expect(getEffectiveWeekStart(1)).toBe(PERSIAN_WEEK_START);
    });

    it('respects the profile value under the gregorian calendar', () => {
        setLocalePreferences({ calendarSystem: 'gregorian' });
        expect(getEffectiveWeekStart(1)).toBe(1);
        expect(getEffectiveWeekStart(0)).toBe(0);
    });
});

describe('formatDisplayNumber', () => {
    it('uses persian digits by default and latin when enabled', () => {
        expect(formatDisplayNumber(1403, { useGrouping: false }, 'fa')).toBe(
            '۱۴۰۳'
        );
        setLocalePreferences({ latinDigits: true });
        expect(formatDisplayNumber(1403, { useGrouping: false }, 'fa')).toBe(
            '1403'
        );
    });
});
