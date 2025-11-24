const moment = require('moment-timezone');

/**
 * Convert a date string from user timezone to UTC for database storage
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} userTimezone - User's timezone (e.g., 'America/New_York')
 * @param {string} timeOfDay - Time of day ('start' for 00:00:00, 'end' for 23:59:59)
 * @returns {Date} UTC Date object
 */
function dateStringToUTC(dateString, userTimezone, timeOfDay = 'start') {
    if (!dateString) return null;

    // Create moment in user's timezone at start or end of day
    const momentInUserTz = moment.tz(dateString, userTimezone);

    if (timeOfDay === 'end') {
        momentInUserTz.endOf('day');
    } else {
        momentInUserTz.startOf('day');
    }

    // Convert to UTC Date object
    return momentInUserTz.utc().toDate();
}

/**
 * Convert a UTC date to user timezone date string
 * @param {Date} utcDate - UTC Date object
 * @param {string} userTimezone - User's timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
function utcToUserDateString(utcDate, userTimezone) {
    if (!utcDate) return null;

    return moment.utc(utcDate).tz(userTimezone).format('YYYY-MM-DD');
}

/**
 * Get current date in user's timezone as YYYY-MM-DD string
 * @param {string} userTimezone - User's timezone
 * @returns {string} Today's date in user timezone
 */
function getCurrentDateInTimezone(userTimezone) {
    return moment.tz(userTimezone).format('YYYY-MM-DD');
}

/**
 * Get start and end of day in UTC for a given date in user timezone
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} userTimezone - User's timezone
 * @returns {Object} { start: Date, end: Date } - UTC Date objects
 */
function getDayBoundsInUTC(dateString, userTimezone) {
    if (!dateString) return null;

    const dayStart = dateStringToUTC(dateString, userTimezone, 'start');
    const dayEnd = dateStringToUTC(dateString, userTimezone, 'end');

    return { start: dayStart, end: dayEnd };
}

/**
 * Get today's bounds in UTC for a user's timezone
 * @param {string} userTimezone - User's timezone
 * @returns {Object} { start: Date, end: Date } - UTC Date objects
 */
function getTodayBoundsInUTC(userTimezone) {
    const todayInUserTz = getCurrentDateInTimezone(userTimezone);
    return getDayBoundsInUTC(todayInUserTz, userTimezone);
}

/**
 * Get date range for "upcoming" tasks (next N days) in user timezone
 * Includes today through N days ahead
 * @param {string} userTimezone - User's timezone
 * @param {number} days - Number of days to look ahead (default: 7)
 * @returns {Object} { start: Date, end: Date } - UTC Date objects
 */
function getUpcomingRangeInUTC(userTimezone, days = 7) {
    const now = moment.tz(userTimezone).startOf('day');
    const endDate = now.clone().add(days, 'days').endOf('day');

    return {
        start: now.utc().toDate(),
        end: endDate.utc().toDate(),
    };
}

/**
 * Check if a UTC date falls on "today" in user's timezone
 * @param {Date} utcDate - UTC Date to check
 * @param {string} userTimezone - User's timezone
 * @returns {boolean} True if the date is today in user's timezone
 */
function isToday(utcDate, userTimezone) {
    if (!utcDate) return false;

    const todayInUserTz = getCurrentDateInTimezone(userTimezone);
    const dateInUserTz = utcToUserDateString(utcDate, userTimezone);

    return todayInUserTz === dateInUserTz;
}

/**
 * Check if a UTC date is overdue (before today) in user's timezone
 * @param {Date} utcDate - UTC Date to check
 * @param {string} userTimezone - User's timezone
 * @returns {boolean} True if the date is before today in user's timezone
 */
function isOverdue(utcDate, userTimezone) {
    if (!utcDate) return false;

    const todayInUserTz = getCurrentDateInTimezone(userTimezone);
    const dateInUserTz = utcToUserDateString(utcDate, userTimezone);

    return dateInUserTz < todayInUserTz;
}

/**
 * Convert due_date from request body to UTC Date for database storage
 * @param {string} dueDateString - Due date from frontend (YYYY-MM-DD)
 * @param {string} userTimezone - User's timezone
 * @returns {Date|null} UTC Date object or null
 */
function processDueDateForStorage(dueDateString, userTimezone) {
    if (!dueDateString || dueDateString.trim() === '') {
        return null;
    }

    // Convert user's date to UTC at end of day in their timezone
    // This ensures the task remains "due" throughout their entire day
    return dateStringToUTC(dueDateString, userTimezone, 'end');
}

/**
 * Convert UTC due_date from database to user timezone string for frontend
 * @param {Date} utcDueDate - Due date from database (UTC)
 * @param {string} userTimezone - User's timezone
 * @returns {string|null} Date string (YYYY-MM-DD) or null
 */
function processDueDateForResponse(utcDueDate, userTimezone) {
    if (!utcDueDate) return null;

    return utcToUserDateString(utcDueDate, userTimezone);
}

/**
 * Convert defer_until datetime from request body to UTC Date for database storage
 * @param {string} deferUntilString - Defer until datetime from frontend (ISO 8601 format)
 * @param {string} userTimezone - User's timezone
 * @returns {Date|null} UTC Date object or null
 */
function processDeferUntilForStorage(deferUntilString, userTimezone) {
    if (!deferUntilString || deferUntilString.trim() === '') {
        return null;
    }

    // Parse the datetime string in the user's timezone
    const momentInUserTz = moment.tz(deferUntilString, userTimezone);

    // Convert to UTC Date object
    return momentInUserTz.utc().toDate();
}

/**
 * Convert UTC defer_until from database to user timezone ISO string for frontend
 * @param {Date} utcDeferUntil - Defer until from database (UTC)
 * @param {string} userTimezone - User's timezone
 * @returns {string|null} ISO datetime string or null
 */
function processDeferUntilForResponse(utcDeferUntil, userTimezone) {
    if (!utcDeferUntil) return null;

    return moment.utc(utcDeferUntil).tz(userTimezone).toISOString();
}

/**
 * Validate timezone string
 * @param {string} timezone - Timezone to validate
 * @returns {boolean} True if timezone is valid
 */
function isValidTimezone(timezone) {
    if (!timezone || typeof timezone !== 'string') {
        return false;
    }

    try {
        // moment.tz.zone() returns null for invalid timezones
        return moment.tz.zone(timezone) !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Get safe timezone (fallback to UTC if invalid)
 * @param {string} timezone - Timezone to validate
 * @returns {string} Valid timezone or 'UTC'
 */
function getSafeTimezone(timezone) {
    return isValidTimezone(timezone) ? timezone : 'UTC';
}

module.exports = {
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
    processDeferUntilForStorage,
    processDeferUntilForResponse,
    isValidTimezone,
    getSafeTimezone,
};
