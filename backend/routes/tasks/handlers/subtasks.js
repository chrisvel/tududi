const { Task, Tag, Project } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const { logError } = require('../../../services/logService');
const { serializeTask } = require('../helpers');

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

module.exports = {
    getSubtasks,
};
