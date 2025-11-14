const { Task } = require('../../../models');
const {
    calculateNextDueDate,
} = require('../../../services/recurringTaskService');
const {
    processDueDateForResponse,
    getSafeTimezone,
} = require('../../../utils/timezone-utils');

/**
 * Calculate next recurring iterations for a task
 */
async function calculateNextIterations(task, startFromDate, userTimezone) {
    const iterations = [];

    // Allow starting from a specific date (for child tasks) or default to today
    const startDate = startFromDate ? new Date(startFromDate) : new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    // Calculate next iteration directly using recurrence logic
    let nextDate = new Date(startDate);

    // For daily recurrence, start from the next day after startDate
    if (task.recurrence_type === 'daily') {
        nextDate.setDate(
            nextDate.getDate() + (task.recurrence_interval || 1)
        );
    } else if (task.recurrence_type === 'weekly') {
        // For weekly, find next occurrence of the target weekday
        const interval = task.recurrence_interval || 1;
        if (
            task.recurrence_weekday !== null &&
            task.recurrence_weekday !== undefined
        ) {
            const currentWeekday = nextDate.getDay();
            const daysUntilTarget =
                (task.recurrence_weekday - currentWeekday + 7) % 7;
            if (daysUntilTarget === 0) {
                // If startDate is the target weekday, move to next week
                nextDate.setDate(nextDate.getDate() + interval * 7);
            } else {
                nextDate.setDate(nextDate.getDate() + daysUntilTarget);
            }
        } else {
            nextDate.setDate(nextDate.getDate() + interval * 7);
        }
    } else {
        // For other types, use the RecurringTaskService method but calculate from startDate
        nextDate = calculateNextDueDate(task, startDate);
    }

    for (let i = 0; i < 5 && nextDate; i++) {
        // Check if recurrence has an end date and we've exceeded it
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

        // Calculate the next iteration by adding the interval
        if (task.recurrence_type === 'daily') {
            nextDate = new Date(nextDate);
            nextDate.setDate(
                nextDate.getDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            nextDate = new Date(nextDate);
            nextDate.setDate(
                nextDate.getDate() + (task.recurrence_interval || 1) * 7
            );
        } else {
            // For monthly and other complex recurrences, use the service method
            nextDate = calculateNextDueDate(task, nextDate);
        }
    }

    return iterations;
}

module.exports = {
    calculateNextIterations,
};
