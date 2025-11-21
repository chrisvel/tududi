const { Task } = require('../../../models');
const taskRepository = require('../../../repositories/TaskRepository');
const {
    calculateNextDueDate,
} = require('../../../services/recurringTaskService');
const {
    processDueDateForResponse,
    getSafeTimezone,
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

    const startDate = startFromDate ? new Date(startFromDate) : new Date();
    startDate.setUTCHours(0, 0, 0, 0);

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
            const todayWeekday = nextDate.getDay();
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
            const todayWeekday = nextDate.getDay();
            includesToday = task.recurrence_weekday === todayWeekday;
        }
    } else if (task.recurrence_type === 'daily') {
        // For daily recurrence, today is always included
        includesToday = true;
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
            nextDate.setDate(
                nextDate.getDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            const interval = task.recurrence_interval || 1;
            if (
                task.recurrence_weekday !== null &&
                task.recurrence_weekday !== undefined
            ) {
                const currentWeekday = nextDate.getDay();
                const daysUntilTarget =
                    (task.recurrence_weekday - currentWeekday + 7) % 7;
                if (daysUntilTarget === 0) {
                    nextDate.setDate(nextDate.getDate() + interval * 7);
                } else {
                    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
                }
            } else {
                nextDate.setDate(nextDate.getDate() + interval * 7);
            }
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
            nextDate.setDate(
                nextDate.getDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            nextDate = new Date(nextDate);

            // Handle multiple weekdays
            if (task.recurrence_weekdays) {
                // Sequelize getter already parses JSON, so it's already an array
                const weekdays = Array.isArray(task.recurrence_weekdays)
                    ? task.recurrence_weekdays
                    : JSON.parse(task.recurrence_weekdays);
                const currentWeekday = nextDate.getDay();

                // Find next matching weekday
                let found = false;
                for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
                    const testDate = new Date(nextDate);
                    testDate.setDate(testDate.getDate() + daysAhead);
                    const testWeekday = testDate.getDay();

                    if (weekdays.includes(testWeekday)) {
                        nextDate = testDate;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    // Fallback: add 7 days
                    nextDate.setDate(nextDate.getDate() + 7);
                }
            } else {
                // Old behavior for single weekday
                nextDate.setDate(
                    nextDate.getDate() + (task.recurrence_interval || 1) * 7
                );
            }
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
