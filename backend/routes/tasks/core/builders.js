const { Task } = require('../../../models');
const { parsePriority, parseStatus } = require('./parsers');
const {
    processDueDateForStorage,
    processDeferUntilForStorage,
} = require('../../../utils/timezone-utils');

function buildTaskAttributes(body, userId, timezone, isUpdate = false) {
    const attrs = {
        name: body.name?.trim(),
        priority: parsePriority(body.priority),
        due_date: processDueDateForStorage(body.due_date, timezone),
        defer_until: processDeferUntilForStorage(body.defer_until, timezone),
        status: parseStatus(body.status),
        note: body.note,
        today: body.today !== undefined ? body.today : false,
        recurrence_type: body.recurrence_type || 'none',
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
        today: body.today !== undefined ? body.today : task.today,
        recurrence_type:
            body.recurrence_type !== undefined
                ? body.recurrence_type
                : task.recurrence_type,
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

    // Only process dates if they are present in the body
    if (body.due_date !== undefined) {
        attrs.due_date = processDueDateForStorage(body.due_date, timezone);
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
