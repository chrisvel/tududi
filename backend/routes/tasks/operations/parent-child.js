const { Task } = require('../../../models');
const { Op } = require('sequelize');
const { logError } = require('../../../services/logService');

async function checkAndUpdateParentTaskCompletion(parentTaskId, userId) {
    try {
        const subtasks = await Task.findAll({
            where: {
                parent_task_id: parentTaskId,
                user_id: userId,
            },
        });

        const allSubtasksDone =
            subtasks.length > 0 &&
            subtasks.every(
                (subtask) =>
                    subtask.status === Task.STATUS.DONE ||
                    subtask.status === 'done'
            );

        if (allSubtasksDone) {
            const parentTask = await Task.findOne({
                where: {
                    id: parentTaskId,
                    user_id: userId,
                },
            });

            if (
                parentTask &&
                parentTask.status !== Task.STATUS.DONE &&
                parentTask.status !== 'done'
            ) {
                await Task.update(
                    {
                        status: Task.STATUS.DONE,
                        completed_at: new Date(),
                    },
                    {
                        where: {
                            id: parentTaskId,
                            user_id: userId,
                        },
                    }
                );
                return true;
            }
        }
        return false;
    } catch (error) {
        logError('Error checking parent task completion:', error);
        return false;
    }
}

async function undoneParentTaskIfNeeded(parentTaskId, userId) {
    try {
        const parentTask = await Task.findOne({
            where: {
                id: parentTaskId,
                user_id: userId,
            },
        });

        if (
            parentTask &&
            (parentTask.status === Task.STATUS.DONE ||
                parentTask.status === 'done')
        ) {
            await Task.update(
                {
                    status: Task.STATUS.NOT_STARTED,
                    completed_at: null,
                },
                {
                    where: {
                        id: parentTaskId,
                        user_id: userId,
                    },
                }
            );
            return true;
        }
        return false;
    } catch (error) {
        logError('Error undoing parent task:', error);
        return false;
    }
}

async function completeAllSubtasks(parentTaskId, userId) {
    try {
        const result = await Task.update(
            {
                status: Task.STATUS.DONE,
                completed_at: new Date(),
            },
            {
                where: {
                    parent_task_id: parentTaskId,
                    user_id: userId,
                },
            }
        );
        return result[0] > 0;
    } catch (error) {
        logError('Error completing all subtasks:', error);
        return false;
    }
}

async function undoneAllSubtasks(parentTaskId, userId) {
    try {
        const result = await Task.update(
            {
                status: Task.STATUS.NOT_STARTED,
                completed_at: null,
            },
            {
                where: {
                    parent_task_id: parentTaskId,
                    user_id: userId,
                    status: {
                        [Op.in]: [Task.STATUS.DONE, 'done'],
                    },
                },
            }
        );
        return result[0] > 0;
    } catch (error) {
        logError('Error undoing all subtasks:', error);
        return false;
    }
}

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
    checkAndUpdateParentTaskCompletion,
    undoneParentTaskIfNeeded,
    completeAllSubtasks,
    undoneAllSubtasks,
    handleParentChildOnStatusChange,
};
