const { Project, Task } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');

async function validateProjectAccess(projectId, userId) {
    if (!projectId || !projectId.toString().trim()) {
        return null;
    }

    const project = await Project.findOne({ where: { id: projectId } });
    if (!project) {
        throw new Error('Invalid project.');
    }

    const projectAccess = await permissionsService.getAccess(
        userId,
        'project',
        project.uid
    );
    const isOwner = project.user_id === userId;
    const canWrite =
        isOwner || projectAccess === 'rw' || projectAccess === 'admin';

    if (!canWrite) {
        throw new Error('Forbidden');
    }

    return projectId;
}

async function validateParentTaskAccess(parentTaskId, userId) {
    if (!parentTaskId || !parentTaskId.toString().trim()) {
        return null;
    }

    const parentTask = await Task.findOne({
        where: { id: parentTaskId, user_id: userId },
    });
    if (!parentTask) {
        const anyTask = await Task.findOne({
            where: { id: parentTaskId },
        });
        if (anyTask) {
            throw new Error(
                `Invalid parent task. Parent task exists but belongs to a different user (parent user_id: ${anyTask.user_id}, current user_id: ${userId}).`
            );
        } else {
            throw new Error(
                `Invalid parent task. Parent task with id ${parentTaskId} not found.`
            );
        }
    }

    const parentAccess = await permissionsService.getAccess(
        userId,
        'task',
        parentTask.uid
    );
    const isOwner = parentTask.user_id === userId;
    const canWrite =
        isOwner || parentAccess === 'rw' || parentAccess === 'admin';

    if (!canWrite) {
        throw new Error('Invalid parent task. Insufficient permissions.');
    }

    return parentTaskId;
}

/**
 * Validates that defer_until date is not after the due_date for regular tasks,
 * or after the recurrence_end_date for recurring task instances.
 *
 * @param {string|Date|null} deferUntil - The defer until date
 * @param {string|Date|null} dueDate - The task due date
 * @param {string|Date|null|undefined} recurringParentEndDate - The parent task's recurrence end date
 *        undefined = not a recurring instance (apply strict validation)
 *        null = recurring instance with no end date (allow any defer_until)
 *        date = recurring instance with end date (validate against end date)
 * @throws {Error} If defer_until is after the applicable end date
 *
 * Validation rules:
 * - If no defer_until or due_date: validation passes
 * - If recurringParentEndDate is undefined (not provided): regular task, defer_until must be <= due_date
 * - If recurringParentEndDate is null: infinite recurrence, any defer_until is allowed
 * - If recurringParentEndDate is a date: defer_until must be <= end date
 */
function validateDeferUntilAndDueDate(
    deferUntil,
    dueDate,
    recurringParentEndDate = undefined
) {
    // Both must be present to validate
    if (!deferUntil || !dueDate) {
        return;
    }

    const deferDate = new Date(deferUntil);
    const dueDateObj = new Date(dueDate);

    // Check if dates are valid
    if (isNaN(deferDate.getTime()) || isNaN(dueDateObj.getTime())) {
        return;
    }

    // Check if this is a recurring instance (parameter was explicitly passed)
    if (recurringParentEndDate !== undefined) {
        // If parent has null end date, it's infinite recurrence - allow any defer_until
        if (recurringParentEndDate === null) {
            return;
        }

        // Parent has an end date - validate against it
        const endDate = new Date(recurringParentEndDate);
        if (!isNaN(endDate.getTime())) {
            if (deferDate > endDate) {
                throw new Error(
                    'Defer until date cannot be after the recurring task end date.'
                );
            }
            // Validation passes - defer can be after due_date but within recurrence bounds
            return;
        }

        // Invalid end date but has parent - treat as infinite recurrence
        return;
    }

    // Not a recurring instance - apply strict validation
    // Defer until must be before or equal to due date
    if (deferDate > dueDateObj) {
        throw new Error('Defer until date cannot be after the due date.');
    }
}

module.exports = {
    validateProjectAccess,
    validateParentTaskAccess,
    validateDeferUntilAndDueDate,
};
