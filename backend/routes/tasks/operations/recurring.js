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
    const recurrenceChanged = recurrenceFields.some((field) => {
        const newValue = reqBody[field];
        return newValue !== undefined && newValue !== task[field];
    });

    if (!recurrenceChanged || task.recurrence_type === 'none') {
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
                await futureInstance.destroy();
            }
        }
    }

    return recurrenceChanged;
}

async function calculateNextIterations(task, startFromDate, userTimezone) {
    const iterations = [];

    const startDate = startFromDate ? new Date(startFromDate) : new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    let nextDate = new Date(startDate);

    if (task.recurrence_type === 'daily') {
        nextDate.setDate(nextDate.getDate() + (task.recurrence_interval || 1));
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

    for (let i = 0; i < 5 && nextDate; i++) {
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
            nextDate.setDate(
                nextDate.getDate() + (task.recurrence_interval || 1) * 7
            );
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
