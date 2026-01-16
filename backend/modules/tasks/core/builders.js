const { Task } = require('../../../models');
const { parsePriority, parseStatus } = require('./parsers');
const {
    processDueDateForStorage,
    processDeferUntilForStorage,
} = require('../../../utils/timezone-utils');

function buildTaskAttributes(body, userId, timezone, isUpdate = false) {
    const recurrenceType = body.recurrence_type || 'none';
    const isRecurring = recurrenceType && recurrenceType !== 'none';

    let dueDate = body.due_date;
    if (
        isRecurring &&
        (dueDate === undefined || dueDate === null || dueDate === '')
    ) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dueDate = `${year}-${month}-${day}`;
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
        name: body.name,
        priority:
            body.priority !== undefined
                ? parsePriority(body.priority)
                : undefined,
        status:
            body.status !== undefined
                ? parseStatus(body.status)
                : Task.STATUS.NOT_STARTED,
        note: body.note,
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
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            attrs.due_date = processDueDateForStorage(
                `${year}-${month}-${day}`,
                timezone
            );
        } else {
            attrs.due_date = processDueDateForStorage(body.due_date, timezone);
        }
    } else if (isAddingRecurrence && (!task.due_date || task.due_date === '')) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dueDate = `${year}-${month}-${day}`;
        attrs.due_date = processDueDateForStorage(dueDate, timezone);
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
};
