const taskRepository = require('../repository');
const { buildTaskAttributes } = require('../core/builders');
const { getSafeTimezone } = require('../../../utils/timezone-utils');
const { ValidationError, ForbiddenError } = require('../../../shared/errors');
const {
    validateProjectAccess,
    validateAreaAccess,
    validateParentTaskAccess,
    validateGoalAccess,
    validateAssignee,
    validateDeferUntilAndDueDate,
    getRecurringParentEndDate,
} = require('../utils/validation');
const { updateTaskTags } = require('./tags');
const { createSubtasks } = require('./subtasks');

// Shared creation rules for the task route and explicit capture. Callers own
// quota checks, transaction boundaries and response/notification handling.
async function createTask(body, user, options = {}) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
        throw new ValidationError('Task name is required.');
    }
    const attributes = buildTaskAttributes(
        body,
        user.id,
        getSafeTimezone(user.timezone)
    );
    try {
        const parentEndDate = await getRecurringParentEndDate(
            body.recurring_parent_id,
            user.id
        );
        validateDeferUntilAndDueDate(
            attributes.defer_until,
            attributes.due_date,
            parentEndDate
        );
        attributes.project_id = await validateProjectAccess(
            body.project_uid || body.project_id,
            user.id
        );
        attributes.area_id = await validateAreaAccess(
            body.area_uid || body.area_id,
            user.id
        );
        attributes.parent_task_id = await validateParentTaskAccess(
            body.parent_task_id,
            user.id
        );
        attributes.goal_id = await validateGoalAccess(body.goal_id, user.id);
        await validateAssignee(attributes.assigned_to, user.id, {
            projectId: attributes.project_id,
        });
    } catch (error) {
        if (error.message === 'Forbidden') throw new ForbiddenError();
        throw new ValidationError(error.message);
    }
    const task = await taskRepository.create(attributes, options);
    await updateTaskTags(task, body.tags || body.Tags, user.id, options);
    await createSubtasks(task.id, body.subtasks, user.id, options);
    return task;
}

module.exports = { createTask };
