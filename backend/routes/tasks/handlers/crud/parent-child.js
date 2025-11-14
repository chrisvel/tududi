const { Task } = require('../../../../models');
const {
    checkAndUpdateParentTaskCompletion,
    undoneParentTaskIfNeeded,
    completeAllSubtasks,
    undoneAllSubtasks,
} = require('../../helpers');

async function handleParentChildOnStatusChange(
    task,
    oldStatus,
    newStatus,
    userId
) {
    let parentChildLogicExecuted = false;

    const directSubtasksQuery = await Task.findAll({
        where: {
            parent_task_id: task.id,
            user_id: userId,
        },
        attributes: ['id', 'name', 'status', 'parent_task_id'],
    });

    if (
        directSubtasksQuery.length > 0 &&
        (!task.Subtasks || task.Subtasks.length === 0)
    ) {
        task.Subtasks = directSubtasksQuery;
    }

    if (task.parent_task_id) {
        if (newStatus === Task.STATUS.DONE || newStatus === 'done') {
            const parentUpdated = await checkAndUpdateParentTaskCompletion(
                task.parent_task_id,
                userId
            );
            if (parentUpdated) {
                parentChildLogicExecuted = true;
            }
        } else if (oldStatus === Task.STATUS.DONE || oldStatus === 'done') {
            const parentUpdated = await undoneParentTaskIfNeeded(
                task.parent_task_id,
                userId
            );
            if (parentUpdated) {
                parentChildLogicExecuted = true;
            }
        }
    } else if (task.Subtasks && task.Subtasks.length > 0) {
        if (newStatus === Task.STATUS.DONE) {
            const subtasksUpdated = await completeAllSubtasks(task.id, userId);
            if (subtasksUpdated) {
                parentChildLogicExecuted = true;
            }
        } else if (oldStatus === Task.STATUS.DONE || oldStatus === 'done') {
            const subtasksUpdated = await undoneAllSubtasks(task.id, userId);
            if (subtasksUpdated) {
                parentChildLogicExecuted = true;
            }
        }
    }

    return parentChildLogicExecuted;
}

module.exports = {
    handleParentChildOnStatusChange,
};
