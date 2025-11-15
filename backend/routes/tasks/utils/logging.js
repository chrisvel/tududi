const { logError } = require('../../../services/logService');
const {
    logTaskUpdate,
    logEvent,
} = require('../../../services/taskEventService');

function captureOldValues(task) {
    return {
        name: task.name,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        project_id: task.project_id,
        note: task.note,
        recurrence_type: task.recurrence_type,
        recurrence_interval: task.recurrence_interval,
        recurrence_end_date: task.recurrence_end_date,
        recurrence_weekday: task.recurrence_weekday,
        recurrence_month_day: task.recurrence_month_day,
        recurrence_week_of_month: task.recurrence_week_of_month,
        completion_based: task.completion_based,
        tags: task.Tags
            ? task.Tags.map((tag) => ({ id: tag.id, name: tag.name }))
            : [],
    };
}

async function logTaskChanges(task, oldValues, reqBody, tagsData, userId) {
    try {
        const changes = {};
        const fields = [
            'name',
            'status',
            'priority',
            'project_id',
            'note',
            'recurrence_type',
            'recurrence_interval',
            'recurrence_end_date',
            'recurrence_weekday',
            'recurrence_month_day',
            'recurrence_week_of_month',
            'completion_based',
        ];

        fields.forEach((field) => {
            if (
                reqBody[field] !== undefined &&
                reqBody[field] !== oldValues[field]
            ) {
                changes[field] = {
                    oldValue: oldValues[field],
                    newValue: reqBody[field],
                };
            }
        });

        if (reqBody.due_date !== undefined) {
            const oldDateStr = oldValues.due_date
                ? oldValues.due_date.toISOString().split('T')[0]
                : null;
            const newDateStr = reqBody.due_date || null;

            if (oldDateStr !== newDateStr) {
                changes.due_date = {
                    oldValue: oldValues.due_date,
                    newValue: reqBody.due_date,
                };
            }
        }

        if (Object.keys(changes).length > 0) {
            await logTaskUpdate(task.id, userId, changes, { source: 'web' });
        }

        if (tagsData) {
            const newTags = tagsData.map((tag) => ({
                id: tag.id,
                name: tag.name,
            }));
            const oldTagNames = oldValues.tags.map((tag) => tag.name).sort();
            const newTagNames = newTags.map((tag) => tag.name).sort();

            if (JSON.stringify(oldTagNames) !== JSON.stringify(newTagNames)) {
                await logEvent({
                    taskId: task.id,
                    userId: userId,
                    eventType: 'tags_changed',
                    fieldName: 'tags',
                    oldValue: oldValues.tags,
                    newValue: newTags,
                    metadata: { source: 'web', action: 'tags_update' },
                });
            }
        }
    } catch (eventError) {
        logError('Error logging task update events:', eventError);
    }
}

module.exports = {
    captureOldValues,
    logTaskChanges,
};
