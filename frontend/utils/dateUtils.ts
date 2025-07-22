import { format, Locale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { el } from 'date-fns/locale/el';
import i18n from '../i18n';

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
 * Example: "Jan 1, 2023 3:30 PM" (in English)
 *
 * @param date - The date to format
 * @returns The formatted date and time string
 */
export const formatDateTime = (date: Date | number): string => {
    return formatLocalizedDate(
        date,
        getDateFormatPattern('dateTime', 'MMM d, yyyy h:mm a')
    );
};

/**
 * Checks if a task in today plan has been there for more than a day (likely overdue)
 *
 * @param task - The task to check
 * @returns True if the task is likely overdue in today plan, false otherwise
 */
export const isTaskOverdue = (task: {
    today?: boolean;
    created_at?: string;
    today_move_count?: number;
    status: string | number;
    completed_at: string | null;
}): boolean => {
    // If task is not in today plan, it's not overdue
    if (!task.today) {
        return false;
    }

    // Only hide overdue badge if task is actually completed (done/archived), not just in progress
    if (
        task.completed_at ||
        task.status === 'done' ||
        task.status === 2 ||
        task.status === 'archived' ||
        task.status === 3
    ) {
        return false;
    }

    // If task has been moved to today multiple times, it's likely been sitting around
    if (task.today_move_count && task.today_move_count > 1) {
        return true;
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
