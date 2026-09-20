const { Project, Task, Area, Goal, Person } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const { getWorkspaceUserIds } = require('../../../services/workspaceMembers');
const peopleRepository = require('../../people/repository');

function isUid(value) {
    const str = value.toString().trim();
    return isNaN(Number(str)) || !Number.isInteger(Number(str));
}

const MAX_TASK_UID_LENGTH = 255;

// Tasks created by CalDAV clients (tasks.org, DAVx5, iOS Reminders) keep the
// remote VTODO UID, which is not a Tududi nanoid. Route params must therefore
// accept any non-empty identifier and let the database lookup decide.
function isValidTaskUid(value) {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_TASK_UID_LENGTH
    );
}

async function validateProjectAccess(projectIdOrUid, userId) {
    if (!projectIdOrUid || !projectIdOrUid.toString().trim()) {
        return null;
    }

    const value = projectIdOrUid.toString().trim();
    const where = isUid(value) ? { uid: value } : { id: value };
    const project = await Project.findOne({ where });
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

    return project.id;
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

    // Not a recurring instance - apply strict validation.
    // Due dates are date-only (no time picker), so treat them as end-of-day
    // so that any defer_until time on the same calendar day is allowed.
    const dueDateEndOfDay = new Date(dueDateObj);
    dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
    if (deferDate > dueDateEndOfDay) {
        throw new Error('Defer until date cannot be after the due date.');
    }
}

async function validateAreaAccess(areaIdOrUid, userId) {
    if (!areaIdOrUid || !areaIdOrUid.toString().trim()) {
        return null;
    }

    const value = areaIdOrUid.toString().trim();
    const where = isUid(value)
        ? { uid: value, user_id: userId }
        : { id: value, user_id: userId };
    const area = await Area.findOne({ where });
    if (!area) {
        throw new Error('Invalid area.');
    }

    return area.id;
}

async function validateGoalAccess(goalIdOrUid, userId) {
    if (!goalIdOrUid || !goalIdOrUid.toString().trim()) {
        return null;
    }

    const value = goalIdOrUid.toString().trim();
    const where = isUid(value)
        ? { uid: value, user_id: userId }
        : { id: value, user_id: userId };
    const goal = await Goal.findOne({ where });
    if (!goal) {
        throw new Error('Invalid goal.');
    }

    return goal.id;
}

// Assigning a task hands the assignee's account write access to it and sends
// them a notification, so the person must be one the caller could pick in the
// assignee list: one of their own cards, or the self-person of someone they
// work with (share partners, group members, and members of the task's
// project). Keeping the assignee a task already has is always allowed.
async function validateAssignee(
    assignedTo,
    userId,
    { projectId = null, currentAssignedTo = null } = {}
) {
    if (!assignedTo) return null;
    if (assignedTo === currentAssignedTo) return assignedTo;

    const person = await Person.findOne({
        where: { uid: String(assignedTo) },
        attributes: ['user_id', 'linked_user_id'],
        raw: true,
    });
    if (!person) throw new Error('Invalid assignee.');
    if (person.user_id === userId) return assignedTo;

    const isSelfPerson = person.linked_user_id === person.user_id;
    if (isSelfPerson) {
        const allowed = new Set(await getWorkspaceUserIds(userId));
        if (projectId) {
            const project = await Project.findByPk(projectId, {
                attributes: ['uid', 'user_id'],
            });
            if (project) {
                allowed.add(project.user_id);
                (
                    await peopleRepository.findProjectCollaboratorUserIds(
                        project.uid
                    )
                ).forEach((id) => allowed.add(id));
            }
        }
        if (allowed.has(person.user_id)) return assignedTo;
    }

    throw new Error('Invalid assignee.');
}

/**
 * Fetches the recurrence end date for a recurring parent task.
 * Used for validating defer_until dates on recurring task instances.
 *
 * @param {number|null|undefined} recurringParentId - The ID of the recurring parent task
 * @param {number} userId - The user ID for access control
 * @returns {Promise<Date|null|undefined>} The parent's recurrence_end_date, null (infinite), or undefined (no parent)
 *          - undefined: no recurring parent (not a recurring instance)
 *          - null: recurring parent with no end date (infinite recurrence)
 *          - Date: recurring parent with specific end date
 */
async function getRecurringParentEndDate(recurringParentId, userId) {
    // No parent ID provided - not a recurring instance
    if (!recurringParentId) return undefined;

    const parent = await Task.findOne({
        where: { id: recurringParentId, user_id: userId },
    });

    // Parent not found or no access - treat as non-recurring (undefined)
    if (!parent) return undefined;

    // Return the end date (null for infinite, Date for specific end)
    return parent.recurrence_end_date;
}

module.exports = {
    isValidTaskUid,
    validateProjectAccess,
    validateParentTaskAccess,
    validateDeferUntilAndDueDate,
    validateAreaAccess,
    validateGoalAccess,
    validateAssignee,
    getRecurringParentEndDate,
};
