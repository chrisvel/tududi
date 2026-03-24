const { Task } = require('../../../models');
const { parseStatus } = require('../core/parsers');

async function handleCompletionStatus(taskAttributes, status, task) {
    if (status === undefined) return;

    const newStatus = parseStatus(status);
    const oldStatus = parseStatus(task.status);

    console.log('[handleCompletionStatus]', {
        taskId: task.id,
        statusParam: status,
        newStatus,
        oldStatus,
        taskCompletedAt: task.completed_at,
    });

    if (newStatus === Task.STATUS.DONE && oldStatus !== Task.STATUS.DONE) {
        console.log('[handleCompletionStatus] Setting completed_at to NOW');
        taskAttributes.completed_at = new Date();
    } else if (
        newStatus !== Task.STATUS.DONE &&
        oldStatus === Task.STATUS.DONE
    ) {
        console.log('[handleCompletionStatus] Clearing completed_at to NULL');
        taskAttributes.completed_at = null;
    } else {
        console.log('[handleCompletionStatus] No completed_at change needed');
    }
}

module.exports = {
    handleCompletionStatus,
};
