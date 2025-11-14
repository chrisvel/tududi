const { Task, Tag, Project } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const { logError } = require('../../../services/logService');
const { serializeTask } = require('../core/serializers');
const { parsePriority, parseStatus } = require('../core/parsers');

async function getSubtasks(parentTaskId, userId, timezone) {
    const parent = await Task.findOne({ where: { id: parentTaskId } });
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

    const subtasks = await Task.findAll({
        where: {
            parent_task_id: parentTaskId,
        },
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
        order: [['created_at', 'ASC']],
    });

    const serializedSubtasks = await Promise.all(
        subtasks.map((subtask) => serializeTask(subtask, timezone))
    );

    return { error: null, subtasks: serializedSubtasks };
}

async function createSubtasks(parentTaskId, subtasks, userId) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    const subtaskPromises = subtasks
        .filter((subtask) => subtask.name && subtask.name.trim())
        .map((subtask) =>
            Task.create({
                name: subtask.name.trim(),
                parent_task_id: parentTaskId,
                user_id: userId,
                priority: parsePriority(subtask.priority) || Task.PRIORITY.LOW,
                status: parseStatus(subtask.status),
                completed_at:
                    subtask.status === 'done' ||
                    subtask.status === Task.STATUS.DONE
                        ? subtask.completed_at
                            ? new Date(subtask.completed_at)
                            : new Date()
                        : null,
                today: subtask.today || false,
                recurrence_type: 'none',
                completion_based: false,
            })
        );

    await Promise.all(subtaskPromises);
}

async function updateSubtasks(taskId, subtasks, userId) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    const existingSubtasks = await Task.findAll({
        where: { parent_task_id: taskId, user_id: userId },
    });

    const subtasksToKeep = subtasks.filter((s) => s.id && !s.isNew);
    const subtasksToDelete = existingSubtasks.filter(
        (existing) => !subtasksToKeep.find((keep) => keep.id === existing.id)
    );

    if (subtasksToDelete.length > 0) {
        await Task.destroy({
            where: {
                id: subtasksToDelete.map((s) => s.id),
                user_id: userId,
            },
        });
    }

    const subtasksToUpdate = subtasks.filter(
        (s) =>
            s.id &&
            ((s.isEdited && s.name && s.name.trim()) || s._statusChanged)
    );

    if (subtasksToUpdate.length > 0) {
        const updatePromises = subtasksToUpdate.map((subtask) => {
            const updateData = {};

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

            return Task.update(updateData, {
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
