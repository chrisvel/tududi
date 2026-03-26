const { Task } = require('../../../models');
const { parsePriority, parseStatus } = require('./parsers');
const {
    processDueDateForStorage,
    processDeferUntilForStorage,
} = require('../../../utils/timezone-utils');

function calculateInitialDueDate(body) {
    const recurrenceType = body.recurrence_type;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    // For monthly recurrence with specific day of month
    if (
        recurrenceType === 'monthly' &&
        body.recurrence_month_day !== undefined &&
        body.recurrence_month_day !== null
    ) {
        const targetDay = body.recurrence_month_day;
        const currentDay = now.getUTCDate();
        const currentMonth = now.getUTCMonth();
        const currentYear = now.getUTCFullYear();

        // Get max day in current month
        const maxDayInMonth = new Date(
            Date.UTC(currentYear, currentMonth + 1, 0)
        ).getUTCDate();
        const actualTargetDay = Math.min(targetDay, maxDayInMonth);

        let firstOccurrence;
        if (actualTargetDay >= currentDay) {
            // Target day is today or later this month
            firstOccurrence = new Date(
                Date.UTC(currentYear, currentMonth, actualTargetDay)
            );
        } else {
            // Target day already passed this month, use next month
            const nextMonth = currentMonth + 1;
            const nextYear = currentYear + Math.floor(nextMonth / 12);
            const finalMonth = nextMonth % 12;
            const maxDayInNextMonth = new Date(
                Date.UTC(nextYear, finalMonth + 1, 0)
            ).getUTCDate();
            const actualTargetDayNextMonth = Math.min(
                targetDay,
                maxDayInNextMonth
            );
            firstOccurrence = new Date(
                Date.UTC(nextYear, finalMonth, actualTargetDayNextMonth)
            );
        }

        const year = firstOccurrence.getUTCFullYear();
        const month = String(firstOccurrence.getUTCMonth() + 1).padStart(
            2,
            '0'
        );
        const day = String(firstOccurrence.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // For weekly recurrence with specific weekday(s)
    if (recurrenceType === 'weekly') {
        const parsedWeekdays = body.recurrence_weekdays
            ? Array.isArray(body.recurrence_weekdays)
                ? body.recurrence_weekdays
                : JSON.parse(body.recurrence_weekdays)
            : null;

        if (parsedWeekdays && parsedWeekdays.length > 0) {
            const sorted = [...parsedWeekdays].sort((a, b) => a - b);
            const currentDay = now.getUTCDay();

            const laterInWeek = sorted.filter((d) => d > currentDay);

            let firstOccurrence;
            if (laterInWeek.length > 0) {
                const daysAhead = laterInWeek[0] - currentDay;
                firstOccurrence = new Date(now);
                firstOccurrence.setUTCDate(now.getUTCDate() + daysAhead);
            } else {
                const daysToNextFirst = (7 - currentDay + sorted[0]) % 7 || 7;
                firstOccurrence = new Date(now);
                firstOccurrence.setUTCDate(now.getUTCDate() + daysToNextFirst);
            }

            const year = firstOccurrence.getUTCFullYear();
            const month = String(firstOccurrence.getUTCMonth() + 1).padStart(
                2,
                '0'
            );
            const day = String(firstOccurrence.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else if (
            body.recurrence_weekday !== undefined &&
            body.recurrence_weekday !== null
        ) {
            const targetWeekday = body.recurrence_weekday;
            const currentWeekday = now.getUTCDay();
            const daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

            const firstOccurrence = new Date(now);
            if (daysUntilTarget === 0) {
                firstOccurrence.setUTCDate(now.getUTCDate());
            } else {
                firstOccurrence.setUTCDate(now.getUTCDate() + daysUntilTarget);
            }

            const year = firstOccurrence.getUTCFullYear();
            const month = String(firstOccurrence.getUTCMonth() + 1).padStart(
                2,
                '0'
            );
            const day = String(firstOccurrence.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    // For other recurrence types (daily, monthly_last_day, etc.), use today
    // as the starting point is reasonable
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildTaskAttributes(body, userId, timezone, isUpdate = false) {
    const recurrenceType = body.recurrence_type || 'none';
    const isRecurring = recurrenceType && recurrenceType !== 'none';

    let dueDate = body.due_date;
    if (
        isRecurring &&
        (dueDate === undefined || dueDate === null || dueDate === '')
    ) {
        // Calculate proper first occurrence based on recurrence pattern
        dueDate = calculateInitialDueDate(body);
    }

    const attrs = {
        name: body.name?.trim(),
        priority: parsePriority(body.priority),
        due_date: processDueDateForStorage(dueDate, timezone),
        defer_until: processDeferUntilForStorage(body.defer_until, timezone),
        status: parseStatus(body.status),
        note: body.note,
        recurrence_type: recurrenceType,
        recurrence_interval: body.recurrence_interval || null,
        recurrence_end_date: body.recurrence_end_date || null,
        recurrence_weekday:
            body.recurrence_weekday !== undefined
                ? body.recurrence_weekday
                : null,
        recurrence_weekdays:
            body.recurrence_weekdays !== undefined
                ? body.recurrence_weekdays
                : null,
        recurrence_month_day:
            body.recurrence_month_day !== undefined
                ? body.recurrence_month_day
                : null,
        recurrence_week_of_month:
            body.recurrence_week_of_month !== undefined
                ? body.recurrence_week_of_month
                : null,
        completion_based: body.completion_based || false,
    };

    if (!isUpdate) {
        attrs.user_id = userId;
    }

    return attrs;
}

function buildUpdateAttributes(body, task, timezone) {
    const recurrenceType =
        body.recurrence_type !== undefined
            ? body.recurrence_type
            : task.recurrence_type;
    const isRecurring = recurrenceType && recurrenceType !== 'none';

    const isAddingRecurrence =
        body.recurrence_type !== undefined &&
        body.recurrence_type !== 'none' &&
        (task.recurrence_type === 'none' || !task.recurrence_type);

    const attrs = {
        name: body.name !== undefined ? body.name : task.name,
        priority:
            body.priority !== undefined
                ? parsePriority(body.priority)
                : task.priority,
        status:
            body.status !== undefined ? parseStatus(body.status) : task.status,
        note: body.note !== undefined ? body.note : task.note,
        recurrence_type: recurrenceType,
        recurrence_interval:
            body.recurrence_interval !== undefined
                ? body.recurrence_interval
                : task.recurrence_interval,
        recurrence_end_date:
            body.recurrence_end_date !== undefined
                ? body.recurrence_end_date
                : task.recurrence_end_date,
        recurrence_weekday:
            body.recurrence_weekday !== undefined
                ? body.recurrence_weekday
                : task.recurrence_weekday,
        recurrence_weekdays:
            body.recurrence_weekdays !== undefined
                ? body.recurrence_weekdays
                : task.recurrence_weekdays,
        recurrence_month_day:
            body.recurrence_month_day !== undefined
                ? body.recurrence_month_day
                : task.recurrence_month_day,
        recurrence_week_of_month:
            body.recurrence_week_of_month !== undefined
                ? body.recurrence_week_of_month
                : task.recurrence_week_of_month,
        completion_based:
            body.completion_based !== undefined
                ? body.completion_based
                : task.completion_based,
    };

    if (body.due_date !== undefined) {
        if (isRecurring && (body.due_date === null || body.due_date === '')) {
            // Calculate proper first occurrence based on recurrence pattern
            const dueDateString = calculateInitialDueDate({
                recurrence_type: recurrenceType,
                recurrence_month_day: attrs.recurrence_month_day,
                recurrence_weekday: attrs.recurrence_weekday,
                recurrence_weekdays: attrs.recurrence_weekdays,
            });
            attrs.due_date = processDueDateForStorage(dueDateString, timezone);
        } else {
            attrs.due_date = processDueDateForStorage(body.due_date, timezone);
        }
    } else if (isAddingRecurrence && (!task.due_date || task.due_date === '')) {
        // Calculate proper first occurrence based on recurrence pattern
        const dueDateString = calculateInitialDueDate({
            recurrence_type: recurrenceType,
            recurrence_month_day: attrs.recurrence_month_day,
            recurrence_weekday: attrs.recurrence_weekday,
            recurrence_weekdays: attrs.recurrence_weekdays,
        });
        attrs.due_date = processDueDateForStorage(dueDateString, timezone);
    }

    if (body.defer_until !== undefined) {
        attrs.defer_until = processDeferUntilForStorage(
            body.defer_until,
            timezone
        );
    }

    return attrs;
}

module.exports = {
    buildTaskAttributes,
    buildUpdateAttributes,
    calculateInitialDueDate,
};
