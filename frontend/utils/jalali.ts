// Life-to-Day (T-303): Jalali (Persian) calendar display layer, Intl-only.
// Storage stays ISO Gregorian (YYYY-MM-DD) and UTC instants everywhere; this
// module only formats for display and converts a picked Jalali day back to a
// Gregorian Date. No date library is added (ADR-010, assumption A-09).
import { getActiveLanguage } from './direction';

// Display timezone holder (mirrors dateUtils.setUserTimezone via
// setDisplayTimezone) so this module never imports dateUtils — that would
// drag the real i18n module graph into tests that mock react-i18next.
let displayTimezone: string | null = null;

export const setDisplayTimezone = (timezone: string | null): void => {
    displayTimezone = timezone || null;
};

export const getDisplayTimezone = (): string =>
    displayTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

export type CalendarSystem = 'gregorian' | 'persian';

export interface LocalePreferences {
    calendarSystem?: CalendarSystem;
    latinDigits?: boolean;
}

let localePreferences: LocalePreferences = {};

export const setLocalePreferences = (
    prefs: LocalePreferences | null | undefined
): void => {
    if (!prefs) return;
    localePreferences = { ...localePreferences, ...prefs };
};

export const getLocalePreferences = (): LocalePreferences => ({
    ...localePreferences,
});

/**
 * The calendar used for display. Independent from language: fa may show
 * Gregorian and en may show Jalali. Unset preference defaults to Jalali for
 * fa and Gregorian for everything else.
 */
export const getCalendarSystem = (language?: string): CalendarSystem => {
    if (localePreferences.calendarSystem) {
        return localePreferences.calendarSystem;
    }
    const lng = (language ?? getActiveLanguage()).split('-')[0];
    return lng === 'fa' ? 'persian' : 'gregorian';
};

export const isPersianCalendar = (): boolean =>
    getCalendarSystem() === 'persian';

export const useLatinDigits = (): boolean =>
    localePreferences.latinDigits ?? false;

// The app's own language codes are not all valid locales (jp, ua).
const INTL_LOCALE: Record<string, string> = { jp: 'ja', ua: 'uk' };

/**
 * Builds the BCP 47 locale used for number display, e.g.
 * fa-IR-u-ca-persian, fa-IR-u-ca-persian-nu-latn or en-u-ca-persian.
 * Date names use resolveDateLocale so a Jalali calendar stays in Persian.
 */
export const resolveDisplayLocale = (language?: string): string => {
    const raw = (language ?? getActiveLanguage()).split('-')[0];
    let base = INTL_LOCALE[raw] || raw;
    if (base === 'fa') base = 'fa-IR';

    const extensions: string[] = [];
    if (getCalendarSystem(language) === 'persian') {
        extensions.push('ca-persian');
    }
    if (useLatinDigits()) {
        extensions.push('nu-latn');
    }
    // Unicode extension keys must be sorted (ca < nu).
    extensions.sort();
    return extensions.length ? `${base}-u-${extensions.join('-')}` : base;
};

/**
 * Locale for date names. Jalali month and weekday names stay Persian even
 * when the UI language is English. Digit choice still follows latinDigits.
 */
export const resolveDateLocale = (language?: string): string =>
    getCalendarSystem(language) === 'persian'
        ? resolveDisplayLocale('fa')
        : resolveDisplayLocale(language);

/**
 * Formats a date for display with the active calendar and digit settings.
 * This is the only supported way to render a user-facing date when the
 * Persian calendar may be active.
 */
export const formatDisplayDate = (
    date: Date | number,
    options: Intl.DateTimeFormatOptions,
    language?: string
): string => {
    return new Intl.DateTimeFormat(resolveDateLocale(language), {
        timeZone: getDisplayTimezone(),
        ...options,
    }).format(date);
};

/** Jalali calendar weeks start on Saturday (6). */
export const PERSIAN_WEEK_START = 6;

export const getEffectiveWeekStart = (profileFirstDay: number): number =>
    isPersianCalendar() ? PERSIAN_WEEK_START : profileFirstDay;

// --- Calendar math via Intl (UTC-based, display-layer only) ---

interface PersianParts {
    year: number;
    month: number;
    day: number;
}

const persianPartsFormatter = new Intl.DateTimeFormat('en-u-ca-persian', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
});

/** Splits a UTC instant into Jalali year/month/day using ICU itself. */
export const toPersianParts = (date: Date | number): PersianParts => {
    const parts = persianPartsFormatter.formatToParts(date);
    const get = (type: string): number => {
        const part = parts.find((p) => p.type === type);
        return part ? parseInt(part.value, 10) : NaN;
    };
    return { year: get('year'), month: get('month'), day: get('day') };
};

/**
 * Splits a local Date into Jalali parts in the user's timezone — the right
 * tool for grid work on local-midnight "date label" Date objects.
 */
export const toPersianPartsInTz = (date: Date | number): PersianParts => {
    const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
        timeZone: getDisplayTimezone(),
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(date);
    const get = (type: string): number => {
        const part = parts.find((p) => p.type === type);
        return part ? parseInt(part.value, 10) : NaN;
    };
    return { year: get('year'), month: get('month'), day: get('day') };
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Structural month lengths of the Jalali calendar: the first six months
// always have 31 days, the next five always 30; Esfand's length (29/30) is
// read from ICU, never hardcoded.
const dayOfYearOffset = (month: number, day: number): number => {
    const before = month <= 7 ? (month - 1) * 31 : 186 + (month - 7) * 30;
    return before + (day - 1);
};

/**
 * Converts a Jalali (year, month, day) to a UTC Date. The estimate anchors
 * Nowruz near March 21 of year+621 and then walks at most a few days until
 * ICU agrees, so no conversion table or library is involved.
 */
export const jalaliToUtcDate = (
    year: number,
    month: number,
    day: number
): Date => {
    const estimate =
        Date.UTC(year + 621, 2, 21) + dayOfYearOffset(month, day) * DAY_MS;
    for (let delta = 0; delta <= 4; delta++) {
        for (const candidate of [
            estimate + delta * DAY_MS,
            estimate - delta * DAY_MS,
        ]) {
            const parts = toPersianParts(candidate);
            if (
                parts.year === year &&
                parts.month === month &&
                parts.day === day
            ) {
                return new Date(candidate);
            }
        }
    }
    // Unreachable for valid Jalali dates with a working ICU; fall back to the
    // estimate rather than throwing in render paths.
    return new Date(estimate);
};

/**
 * Reads the length of Esfand (29 or 30) for a Jalali year from ICU by
 * locating Nowruz and inspecting the day before it.
 */
export const lastDayOfEsfand = (year: number): number => {
    // Nowruz of Jalali year Y falls on March 20 or 21 of Gregorian year
    // Y+621, so Nowruz of `year + 1` lands in Gregorian year+622.
    let cursor = Date.UTC(year + 622, 2, 19);
    for (let i = 0; i < 5; i++) {
        const parts = toPersianParts(cursor);
        if (parts.year === year + 1 && parts.month === 1 && parts.day === 1) {
            return toPersianParts(cursor - DAY_MS).day;
        }
        cursor += DAY_MS;
    }
    return 29; // fallback; common case, only hit if ICU misbehaves
};

/** Length of a Jalali month; Esfand is read from ICU. */
export const persianMonthLength = (year: number, month: number): number => {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    return lastDayOfEsfand(year);
};

/** Persian month name for display (e.g. for a datepicker header). */
export const persianMonthName = (
    year: number,
    month: number,
    language?: string
): string => {
    const date = jalaliToUtcDate(year, month, 1);
    return new Intl.DateTimeFormat(resolveDateLocale(language), {
        timeZone: 'UTC',
        month: 'long',
    }).format(date);
};

/**
 * Converts a Jalali (year, month, day) to a local-midnight Date, matching the
 * app's date-label convention (YYYY-MM-DD parsed as local time).
 */
export const jalaliToLocalDate = (
    year: number,
    month: number,
    day: number
): Date => {
    const iso = jalaliToUtcDate(year, month, day).toISOString().slice(0, 10);
    return new Date(iso + 'T00:00:00');
};

/** Formats a number with the active digit setting (fa digits or Latin). */
export const formatDisplayNumber = (
    value: number,
    options?: Intl.NumberFormatOptions,
    language?: string
): string => {
    return new Intl.NumberFormat(
        resolveDisplayLocale(language),
        options
    ).format(value);
};
