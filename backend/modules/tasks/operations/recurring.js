const { Task } = require('../../../models');
const taskRepository = require('../repository');
const { calculateNextDueDate } = require('../recurringTaskService');
const {
    processDueDateForResponse,
    getSafeTimezone,
    dateStringToUTC,
    getCurrentDateInTimezone,
} = require('../../../utils/timezone-utils');

async function handleRecurrenceUpdate(task, recurrenceFields, reqBody) {
    // Check if recurrence fields changed
    const recurrenceChanged = recurrenceFields.some((field) => {
        const newValue = reqBody[field];
        return newValue !== undefined && newValue !== task[field];
    });

    // Also check if template fields that affect instances have changed
    // These fields should be propagated to all future instances
    const templateFieldsChanged = [
        'name',
        'project_id',
        'priority',
        'note',
    ].some((field) => {
        const newValue = reqBody[field];
        return newValue !== undefined && newValue !== task[field];
    });

    const shouldRegenerateInstances =
        (recurrenceChanged || templateFieldsChanged) &&
        task.recurrence_type !== 'none';

    if (!shouldRegenerateInstances) {
        return false;
    }

    const childTasks = await taskRepository.findRecurringChildren(task.id);

    if (childTasks.length > 0) {
        const now = new Date();
        const futureInstances = childTasks.filter((child) => {
            if (!child.due_date) return true;
            return new Date(child.due_date) > now;
        });

        const newRecurrenceType =
            reqBody.recurrence_type !== undefined
                ? reqBody.recurrence_type
                : task.recurrence_type;

        if (newRecurrenceType !== 'none') {
            for (const futureInstance of futureInstances) {
                try {
                    await futureInstance.destroy();
                } catch (error) {
                    // If dependent records block deletion (e.g., subtasks FK), skip that instance
                    console.warn(
                        'Skipping recurring instance deletion due to constraint:',
                        {
                            id: futureInstance.id,
                            error: error?.message,
                        }
                    );
                }
            }
        }
    }

    return shouldRegenerateInstances;
}

async function calculateNextIterations(task, startFromDate, userTimezone) {
    const iterations = [];
    const safeTimezone = getSafeTimezone(userTimezone);
    const moment = require('moment-timezone');

    // Get today's date string in user's local timezone (YYYY-MM-DD)
    let todayLocalStr;
    if (startFromDate) {
        if (typeof startFromDate === 'string') {
            todayLocalStr = moment
                .tz(startFromDate, safeTimezone)
                .format('YYYY-MM-DD');
        } else {
            // Handle Date objects passed from tests
            todayLocalStr = moment
                .utc(startFromDate)
                .tz(safeTimezone)
                .format('YYYY-MM-DD');
        }
    } else {
        todayLocalStr = getCurrentDateInTimezone(safeTimezone);
    }

    // Parse start date using start-of-day in user timezone (used for weekly/daily logic)
    let startDate = dateStringToUTC(todayLocalStr, safeTimezone, 'start');

    let nextDate = new Date(startDate);
    let includesToday = false;

    // Check if today matches the recurrence pattern
    if (task.recurrence_type === 'weekly') {
        // Check if today matches any of the weekdays
        if (task.recurrence_weekdays) {
            // Note: Sequelize getter already parses JSON, so it's already an array
            const weekdays = Array.isArray(task.recurrence_weekdays)
                ? task.recurrence_weekdays
                : JSON.parse(task.recurrence_weekdays);
            const todayWeekday = nextDate.getUTCDay();
            console.log('Weekly recurrence check:', {
                weekdays,
                todayWeekday,
                includes: weekdays.includes(todayWeekday),
            });
            includesToday = weekdays.includes(todayWeekday);
        } else if (
            task.recurrence_weekday !== null &&
            task.recurrence_weekday !== undefined
        ) {
            const todayWeekday = nextDate.getUTCDay();
            includesToday = task.recurrence_weekday === todayWeekday;
        }
    } else if (task.recurrence_type === 'daily') {
        includesToday = true;
    } else if (task.recurrence_type === 'monthly') {
        // Use the LOCAL date components to avoid UTC offset drift.
        // For UTC+ users, start-of-day UTC is the previous UTC day, so
        // startDate.getUTCDate() would return the wrong day number.
        const localParts = todayLocalStr.split('-');
        const localYear = parseInt(localParts[0], 10);
        const localMonth = parseInt(localParts[1], 10) - 1; // 0-indexed
        const localDay = parseInt(localParts[2], 10);

        const targetDay =
            task.recurrence_month_day !== null &&
            task.recurrence_month_day !== undefined
                ? task.recurrence_month_day
                : localDay;

        if (targetDay > localDay) {
            const maxDayInMonth = new Date(
                Date.UTC(localYear, localMonth + 1, 0)
            ).getUTCDate();

            if (targetDay <= maxDayInMonth) {
                includesToday = true;
                // Build the target date from local components and convert to UTC.
                // This avoids the UTC-hour carry that causes a +1 day shift for UTC+ zones.
                const targetLocalDateStr = `${localParts[0]}-${localParts[1]}-${String(targetDay).padStart(2, '0')}`;
                nextDate = dateStringToUTC(
                    targetLocalDateStr,
                    safeTimezone,
                    'start'
                );
            }
        }
    }

    console.log('calculateNextIterations:', {
        startDate: startDate.toISOString(),
        includesToday,
        recurrence_type: task.recurrence_type,
        recurrence_weekdays: task.recurrence_weekdays,
    });

    // If today doesn't match, calculate the next occurrence
    if (!includesToday) {
        if (task.recurrence_type === 'daily') {
            nextDate.setUTCDate(
                nextDate.getUTCDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            const interval = task.recurrence_interval || 1;
            if (task.recurrence_weekdays) {
                const weekdays = Array.isArray(task.recurrence_weekdays)
                    ? task.recurrence_weekdays
                    : JSON.parse(task.recurrence_weekdays);
                const sorted = [...weekdays].sort((a, b) => a - b);
                const currentDay = nextDate.getUTCDay();
                const laterInWeek = sorted.filter((d) => d > currentDay);
                if (laterInWeek.length > 0) {
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() + (laterInWeek[0] - currentDay)
                    );
                } else {
                    const daysToNextFirst =
                        (7 - currentDay + sorted[0]) % 7 || 7;
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() +
                            daysToNextFirst +
                            (interval - 1) * 7
                    );
                }
            } else if (
                task.recurrence_weekday !== null &&
                task.recurrence_weekday !== undefined
            ) {
                const currentWeekday = nextDate.getUTCDay();
                const daysUntilTarget =
                    (task.recurrence_weekday - currentWeekday + 7) % 7;
                if (daysUntilTarget === 0) {
                    nextDate.setUTCDate(nextDate.getUTCDate() + interval * 7);
                } else {
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() + daysUntilTarget
                    );
                }
            } else {
                nextDate.setUTCDate(nextDate.getUTCDate() + interval * 7);
            }
        } else if (task.recurrence_type === 'monthly') {
            // Advance to next month's occurrence using local timezone arithmetic
            // to avoid UTC-hour drift that causes off-by-one dates for UTC+ users.
            const localParts = todayLocalStr.split('-');
            const localYear = parseInt(localParts[0], 10);
            const localMonth = parseInt(localParts[1], 10); // 1-indexed
            const localDay = parseInt(localParts[2], 10);
            const interval = task.recurrence_interval || 1;
            const targetDay =
                task.recurrence_month_day !== null &&
                task.recurrence_month_day !== undefined
                    ? task.recurrence_month_day
                    : localDay;
            const totalMonths = localMonth - 1 + interval;
            const nextYear = localYear + Math.floor(totalMonths / 12);
            const nextMonthZeroIdx = totalMonths % 12;
            const maxDay = new Date(
                Date.UTC(nextYear, nextMonthZeroIdx + 1, 0)
            ).getUTCDate();
            const finalDay = Math.min(targetDay, maxDay);
            const nextLocalDateStr = `${nextYear}-${String(nextMonthZeroIdx + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
            nextDate = dateStringToUTC(nextLocalDateStr, safeTimezone, 'start');
        } else {
            nextDate = calculateNextDueDate(task, startDate);
        }
    }

    for (let i = 0; i < 6 && nextDate; i++) {
        if (task.recurrence_end_date) {
            const endDate = new Date(task.recurrence_end_date);
            if (nextDate > endDate) {
                break;
            }
        }

        iterations.push({
            date: processDueDateForResponse(
                nextDate,
                getSafeTimezone(userTimezone)
            ),
            utc_date: nextDate.toISOString(),
        });

        if (task.recurrence_type === 'daily') {
            nextDate = new Date(nextDate);
            nextDate.setUTCDate(
                nextDate.getUTCDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            nextDate = new Date(nextDate);

            // Handle multiple weekdays
            if (task.recurrence_weekdays) {
                const weekdays = Array.isArray(task.recurrence_weekdays)
                    ? task.recurrence_weekdays
                    : JSON.parse(task.recurrence_weekdays);
                const interval = task.recurrence_interval || 1;
                const sorted = [...weekdays].sort((a, b) => a - b);
                const currentDay = nextDate.getUTCDay();
                const laterInWeek = sorted.filter((d) => d > currentDay);

                if (laterInWeek.length > 0) {
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() + (laterInWeek[0] - currentDay)
                    );
                } else {
                    const daysToNextFirst =
                        (7 - currentDay + sorted[0]) % 7 || 7;
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() +
                            daysToNextFirst +
                            (interval - 1) * 7
                    );
                }
            } else {
                // Old behavior for single weekday
                nextDate.setUTCDate(
                    nextDate.getUTCDate() + (task.recurrence_interval || 1) * 7
                );
            }
        } else if (task.recurrence_type === 'monthly') {
            // Advance by interval months using local timezone date arithmetic.
            // Using processDueDateForResponse gives us the local date string from
            // the current nextDate, letting us advance months without UTC drift.
            const currentLocalStr = processDueDateForResponse(
                nextDate,
                safeTimezone
            );
            const [y, m, d] = currentLocalStr.split('-').map(Number);
            const interval = task.recurrence_interval || 1;
            const targetDay =
                task.recurrence_month_day !== null &&
                task.recurrence_month_day !== undefined
                    ? task.recurrence_month_day
                    : d;
            const totalMonths = m - 1 + interval;
            const nextYear = y + Math.floor(totalMonths / 12);
            const nextMonthZeroIdx = totalMonths % 12;
            const maxDay = new Date(
                Date.UTC(nextYear, nextMonthZeroIdx + 1, 0)
            ).getUTCDate();
            const finalDay = Math.min(targetDay, maxDay);
            const nextLocalDateStr = `${nextYear}-${String(nextMonthZeroIdx + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
            nextDate = dateStringToUTC(nextLocalDateStr, safeTimezone, 'start');
        } else {
            nextDate = calculateNextDueDate(task, nextDate);
        }
    }

    return iterations;
}

module.exports = {
    handleRecurrenceUpdate,
    calculateNextIterations,
};
