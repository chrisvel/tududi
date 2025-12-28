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

// Check if task is in today's plan (has active status)
export const isTaskInTodayPlan = (
    status: StatusType | number | undefined | null
): boolean =>
    isTaskInProgress(status) || isTaskPlanned(status) || isTaskWaiting(status);

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
export const parseDateString = (dateString: string | null | undefined): Date | null => {
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

    // Check if due date is in the past
    const dueDate = parseDateString(task.due_date);
    if (!dueDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    dueDate.setHours(0, 0, 0, 0); // Start of due date

    return dueDate < today;
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
