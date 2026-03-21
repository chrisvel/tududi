import { format, Locale } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { el } from 'date-fns/locale/el';
import i18n from '../i18n';
import {
    isTaskInProgress,
    isTaskPlanned,
    isTaskWaiting,
} from '../constants/taskStatus';
import { StatusType } from '../entities/Task';
import { getCountryFromTimezone } from './localeUtils';

// Check if task is in today's plan (has active status)
export const isTaskInTodayPlan = (
    status: StatusType | number | undefined | null
): boolean =>
    isTaskInProgress(status) || isTaskPlanned(status) || isTaskWaiting(status);

export const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getTomorrowDateString = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getYesterdayDateString = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

let userTimezone: string | null = null;

export const setUserTimezone = (timezone: string): void => {
    userTimezone = timezone;
};

/**
 * Parses a date string (YYYY-MM-DD) as local midnight.
 * This avoids the timezone bug where `new Date('2025-12-11')` is interpreted as
 * midnight UTC, which displays as the previous day in timezones behind UTC.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object at local midnight, or null if invalid
 */
export const parseDateString = (
    dateString: string | null | undefined
): Date | null => {
    if (!dateString) return null;
    // Adding T00:00:00 makes JavaScript interpret the date as local time
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
};

export const getUserTimezone = (): string => {
    return userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const convertToUserTimezone = (date: Date | number): Date => {
    const timezone = getUserTimezone();
    return toZonedTime(date, timezone);
};

/**
 * Maps i18next language codes to date-fns locale objects
 */
const localeMap: Record<string, Locale> = {
    en: enUS,
    es: es,
    el: el,
};

/**
 * Returns the date-fns locale object based on the current i18next language
 * Falls back to English if the current language is not supported
 */
export const getCurrentLocale = (): Locale => {
    const language = i18n.language || 'en';
    return localeMap[language] || enUS;
};

/**
 * Checks if a task is past its due date
 * @param task - Task object with due_date, status, and completed_at
 * @returns True if task has a due date in the past and is not completed
 */
export const isTaskPastDue = (task: {
    due_date?: string | null;
    status: string | number;
    completed_at: string | null;
}): boolean => {
    // If no due date, task is not past due
    if (!task.due_date) {
        return false;
    }

    // If task is completed, it's not past due
    if (
        task.completed_at ||
        task.status === 'done' ||
        task.status === 2 ||
        task.status === 'archived' ||
        task.status === 3
    ) {
        return false;
    }

    // Check if due date is in the past using string comparison (YYYY-MM-DD)
    const todayStr = getTodayDateString();
    const dueDateStr = task.due_date.split('T')[0];
    return dueDateStr < todayStr;
};

/**
 * Formats a date using the current locale from i18next
 *
 * @param date - The date to format
 * @param formatStr - The format string (https://date-fns.org/v2.29.3/docs/format)
 * @returns The formatted date string
 */
export const formatLocalizedDate = (
    date: Date | number,
    formatStr: string
): string => {
    return format(date, formatStr, {
        locale: getCurrentLocale(),
    });
};

/**
 * Gets the date format pattern from translation file
 *
 * @param formatKey - The key for the format in the dateFormats object
 * @param fallback - Fallback format to use if translation is missing
 * @returns The format pattern string
 */
export const getDateFormatPattern = (
    formatKey: string,
    fallback: string
): string => {
    const pattern = i18n.t(`dateFormats.${formatKey}`);
    // If the translation key doesn't exist, it will return the key itself
    return pattern === `dateFormats.${formatKey}` ? fallback : pattern;
};

/**
 * Formats a date in a long readable format based on the current locale
 * Example: "Monday, January 1, 2023" (in English)
 *
 * @param date - The date to format
 * @returns The formatted date string
 */
export const formatLongDate = (date: Date | number): string => {
    return formatLocalizedDate(
        date,
        getDateFormatPattern('long', 'EEEE, MMMM d, yyyy')
    );
};

/**
 * Formats a date in a short format based on the current locale
 * Example: "Jan 1, 2023" (in English)
 *
 * @param date - The date to format
 * @returns The formatted date string
 */
export const formatShortDate = (date: Date | number): string => {
    return formatLocalizedDate(
        date,
        getDateFormatPattern('short', 'MMM d, yyyy')
    );
};

/**
 * Formats a date to show only month and year based on the current locale
 * Example: "January 2023" (in English)
 *
 * @param date - The date to format
 * @returns The formatted date string
 */
export const formatMonthYear = (date: Date | number): string => {
    return formatLocalizedDate(
        date,
        getDateFormatPattern('monthYear', 'MMMM yyyy')
    );
};

/**
 * Formats a date to show only day and month based on the current locale
 * Example: "January 1" (in English)
 *
 * @param date - The date to format
 * @returns The formatted date string
 */
export const formatDayMonth = (date: Date | number): string => {
    return formatLocalizedDate(
        date,
        getDateFormatPattern('dayMonth', 'MMMM d')
    );
};

/**
 * Formats a date to show only time based on the current locale
 * Example: "3:30 PM" (in English)
 *
 * @param date - The date to format
 * @returns The formatted time string
 */
export const formatTime = (date: Date | number): string => {
    return formatLocalizedDate(date, getDateFormatPattern('time', 'h:mm a'));
};

/**
 * Formats a date to show date and time based on the current locale
 * Converts to user's timezone before formatting
 * Example: "Jan 1, 2023 3:30 PM" (in English)
 *
 * @param date - The date to format (assumed to be UTC)
 * @param useTimezone - Whether to convert to user timezone (default: true)
 * @returns The formatted date and time string
 */
export const formatDateTime = (
    date: Date | number,
    useTimezone: boolean = true
): string => {
    const dateToFormat = useTimezone ? convertToUserTimezone(date) : date;
    return formatLocalizedDate(
        dateToFormat,
        getDateFormatPattern('dateTime', 'MMM d, yyyy h:mm a')
    );
};

/**
 * Checks if a task in today plan has been there for more than a day (likely overdue)
 *
 * @param task - The task to check
 * @returns True if the task is likely overdue in today plan, false otherwise
 */
export const isTaskOverdueInTodayPlan = (task: {
    created_at?: string;
    status: StatusType | number;
    completed_at: string | null;
}): boolean => {
    // If task is not in today plan (no active status), it's not overdue in today plan
    if (!isTaskInTodayPlan(task.status)) {
        return false;
    }

    // Only hide overdue badge if task is actually completed (done/archived)
    if (
        task.completed_at ||
        task.status === 'done' ||
        task.status === 2 ||
        task.status === 'archived' ||
        task.status === 3
    ) {
        return false;
    }

    // If no creation date, can't determine if overdue
    if (!task.created_at) {
        return false;
    }

    const createdDate = new Date(task.created_at);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999); // End of yesterday

    // Task is likely overdue if created before end of yesterday and is in today plan
    // This is an approximation - tasks created yesterday or earlier that are in today plan
    // are likely to have been sitting there for a while
    return createdDate.getTime() < yesterday.getTime();
};

/**
 * Maps ISO 3166-1 country codes to date format patterns.
 * Used to ensure consistent date formatting based on regional conventions,
 * independent of browser locale support.
 *
 * @returns Object mapping country code to date-fns format string
 */
const getCountryDateFormats = (): Record<string, string> => ({
    // DD/MM/YYYY format (most common globally - European standard)
    AT: 'dd/MM/yyyy', // Austria
    BE: 'dd/MM/yyyy', // Belgium
    BG: 'dd/MM/yyyy', // Bulgaria
    CH: 'dd/MM/yyyy', // Switzerland
    CY: 'dd/MM/yyyy', // Cyprus
    CZ: 'dd/MM/yyyy', // Czech Republic
    DE: 'dd/MM/yyyy', // Germany
    DK: 'dd/MM/yyyy', // Denmark
    EE: 'dd/MM/yyyy', // Estonia
    ES: 'dd/MM/yyyy', // Spain
    FI: 'dd/MM/yyyy', // Finland
    FR: 'dd/MM/yyyy', // France
    GB: 'dd/MM/yyyy', // United Kingdom
    GR: 'dd/MM/yyyy', // Greece
    HR: 'dd/MM/yyyy', // Croatia
    IE: 'dd/MM/yyyy', // Ireland
    IS: 'dd/MM/yyyy', // Iceland
    IT: 'dd/MM/yyyy', // Italy
    LT: 'dd/MM/yyyy', // Lithuania
    LU: 'dd/MM/yyyy', // Luxembourg
    LV: 'dd/MM/yyyy', // Latvia
    MT: 'dd/MM/yyyy', // Malta
    NL: 'dd/MM/yyyy', // Netherlands
    NO: 'dd/MM/yyyy', // Norway
    PL: 'dd/MM/yyyy', // Poland
    PT: 'dd/MM/yyyy', // Portugal
    RO: 'dd/MM/yyyy', // Romania
    SE: 'dd/MM/yyyy', // Sweden
    SI: 'dd/MM/yyyy', // Slovenia
    SK: 'dd/MM/yyyy', // Slovakia
    TR: 'dd/MM/yyyy', // Turkey
    RU: 'dd/MM/yyyy', // Russia

    // DD/MM/YYYY format (Africa)
    DZ: 'dd/MM/yyyy', // Algeria
    EG: 'dd/MM/yyyy', // Egypt
    GH: 'dd/MM/yyyy', // Ghana
    KE: 'dd/MM/yyyy', // Kenya
    MA: 'dd/MM/yyyy', // Morocco
    NG: 'dd/MM/yyyy', // Nigeria
    TN: 'dd/MM/yyyy', // Tunisia
    ZA: 'dd/MM/yyyy', // South Africa

    // DD/MM/YYYY format (Asia/Pacific)
    AU: 'dd/MM/yyyy', // Australia
    BD: 'dd/MM/yyyy', // Bangladesh
    FJ: 'dd/MM/yyyy', // Fiji
    GU: 'dd/MM/yyyy', // Guam
    HK: 'dd/MM/yyyy', // Hong Kong
    ID: 'dd/MM/yyyy', // Indonesia
    IN: 'dd/MM/yyyy', // India
    MY: 'dd/MM/yyyy', // Malaysia
    NZ: 'dd/MM/yyyy', // New Zealand
    PK: 'dd/MM/yyyy', // Pakistan
    SG: 'dd/MM/yyyy', // Singapore
    TH: 'dd/MM/yyyy', // Thailand

    // DD/MM/YYYY format (Middle East)
    AE: 'dd/MM/yyyy', // United Arab Emirates
    IL: 'dd/MM/yyyy', // Israel
    IR: 'dd/MM/yyyy', // Iran
    SA: 'dd/MM/yyyy', // Saudi Arabia

    // DD/MM/YYYY format (Americas - except US/CA)
    AR: 'dd/MM/yyyy', // Argentina
    BR: 'dd/MM/yyyy', // Brazil
    CL: 'dd/MM/yyyy', // Chile
    CO: 'dd/MM/yyyy', // Colombia
    MX: 'dd/MM/yyyy', // Mexico
    PE: 'dd/MM/yyyy', // Peru
    VE: 'dd/MM/yyyy', // Venezuela

    // MM/DD/YYYY format (North America and some others)
    US: 'MM/dd/yyyy', // United States
    CA: 'MM/dd/yyyy', // Canada
    PH: 'MM/dd/yyyy', // Philippines

    // YYYY/MM/DD format (East Asia - ISO-like format)
    CN: 'yyyy/MM/dd', // China
    JP: 'yyyy/MM/dd', // Japan
    KR: 'yyyy/MM/dd', // South Korea
    TW: 'yyyy/MM/dd', // Taiwan
});

/**
 * Formats a date using country-specific format pattern.
 * This provides consistent date formatting independent of browser locale support.
 *
 * @param date - Date to format
 * @param country - ISO 3166-1 country code (optional)
 * @returns Formatted date string (e.g., "15/03/2026" for Greece, "03/15/2026" for US)
 */
export const formatDateByCountry = (
    date: Date,
    country?: string | null
): string => {
    const formats = getCountryDateFormats();

    // Use country-specific format if available, otherwise default to DD/MM/YYYY
    const formatPattern =
        country && formats[country] ? formats[country] : 'dd/MM/yyyy';

    return format(date, formatPattern);
};

/**
 * Formats a datetime using country-specific date format + 24-hour time.
 * This provides consistent datetime formatting independent of browser locale support.
 *
 * @param date - Date to format
 * @param country - ISO 3166-1 country code (optional)
 * @returns Formatted datetime string (e.g., "15/03/2026 14:30" for Greece)
 */
export const formatDateTimeByCountry = (
    date: Date,
    country?: string | null
): string => {
    const formats = getCountryDateFormats();

    // Use country-specific format if available, otherwise default to DD/MM/YYYY
    const datePattern =
        country && formats[country] ? formats[country] : 'dd/MM/yyyy';

    // Combine date pattern with 24-hour time format
    const datetimePattern = `${datePattern} HH:mm`;

    return format(date, datetimePattern);
};
