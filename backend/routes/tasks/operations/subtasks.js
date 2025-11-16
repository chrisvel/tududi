const { Task, Tag, Project } = require('../../../models');
const taskRepository = require('../../../repositories/TaskRepository');
const permissionsService = require('../../../services/permissionsService');
const { logError } = require('../../../services/logService');
const { serializeTask } = require('../core/serializers');
const { parsePriority, parseStatus } = require('../core/parsers');

async function getSubtasks(parentTaskId, userId, timezone) {
    const parent = await taskRepository.findById(parentTaskId);
    if (!parent) {
        return { error: 'Not found', subtasks: [] };
    }

    const pAccess = await permissionsService.getAccess(
        userId,
        'task',
        parent.uid
    );
    if (pAccess === 'none') {
        return { error: 'Forbidden', subtasks: null };
    }

    const subtasks = await taskRepository.findAll(
        { parent_task_id: parentTaskId },
        {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
            ],
            order: [
                ['order', 'ASC'],
                ['created_at', 'ASC'],
            ], // Order by order field, fallback to created_at
        }
    );

    const serializedSubtasks = await Promise.all(
        subtasks.map((subtask) => serializeTask(subtask, timezone))
    );

    return { error: null, subtasks: serializedSubtasks };
}

async function createSubtasks(parentTaskId, subtasks, userId) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    // Get the highest order value for existing subtasks
    const existingSubtasks = await taskRepository.findAll(
        { parent_task_id: parentTaskId },
        { attributes: ['order'], order: [['order', 'DESC']], limit: 1 }
    );
    const maxOrder = existingSubtasks[0]?.order ?? 0;

    const subtasksData = subtasks
        .filter((subtask) => subtask.name && subtask.name.trim())
        .map((subtask, index) => ({
            name: subtask.name.trim(),
            parent_task_id: parentTaskId,
            user_id: userId,
            priority: parsePriority(subtask.priority) || Task.PRIORITY.LOW,
            status: parseStatus(subtask.status),
            completed_at:
                subtask.status === 'done' || subtask.status === Task.STATUS.DONE
                    ? subtask.completed_at
                        ? new Date(subtask.completed_at)
                        : new Date()
                    : null,
            today: subtask.today || false,
            recurrence_type: 'none',
            completion_based: false,
            order: maxOrder + index + 1, // Assign sequential order values
        }));

    await taskRepository.createMany(subtasksData);
}

async function updateSubtasks(taskId, subtasks, userId) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    const existingSubtasks = await taskRepository.findChildren(taskId, userId);

    const subtasksToKeep = subtasks.filter((s) => s.id && !s.isNew);
    const subtasksToDelete = existingSubtasks.filter(
        (existing) => !subtasksToKeep.find((keep) => keep.id === existing.id)
    );

    if (subtasksToDelete.length > 0) {
        await taskRepository.destroyMany({
            where: {
                id: subtasksToDelete.map((s) => s.id),
                user_id: userId,
            },
        });
    }

    // Update order for all subtasks to reflect their position in the array
    const allSubtasksToUpdate = subtasks.filter((s) => s.id);

    const subtasksToUpdate = subtasks.filter(
        (s) =>
            s.id &&
            ((s.isEdited && s.name && s.name.trim()) || s._statusChanged)
    );

    if (subtasksToUpdate.length > 0 || allSubtasksToUpdate.length > 0) {
        const updatePromises = allSubtasksToUpdate.map((subtask, index) => {
            const updateData = {
                order: index + 1, // Update order based on position in array
            };

            if (subtasksToUpdate.includes(subtask)) {
                if (subtask.isEdited && subtask.name && subtask.name.trim()) {
                    updateData.name = subtask.name.trim();
                }

                if (subtask._statusChanged || subtask.status !== undefined) {
                    updateData.status = parseStatus(subtask.status);

                    if (
                        updateData.status === Task.STATUS.DONE &&
                        !subtask.completed_at
                    ) {
                        updateData.completed_at = new Date();
                    } else if (updateData.status !== Task.STATUS.DONE) {
                        updateData.completed_at = null;
                    }
                }

                if (subtask.priority !== undefined) {
                    updateData.priority =
                        parsePriority(subtask.priority) || Task.PRIORITY.LOW;
                }
            }

            return taskRepository.bulkUpdate(updateData, {
                where: { id: subtask.id, user_id: userId },
            });
        });

        await Promise.all(updatePromises);
    }

    const newSubtasks = subtasks.filter(
        (s) => s.isNew && s.name && s.name.trim()
    );

    if (newSubtasks.length > 0) {
        await createSubtasks(taskId, newSubtasks, userId);
    }
}

module.exports = {
    getSubtasks,
    createSubtasks,
    updateSubtasks,
};
