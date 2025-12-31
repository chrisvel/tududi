const { Task } = require('../../../models');
const { parseStatus } = require('../core/parsers');

async function handleCompletionStatus(taskAttributes, status, task) {
    if (status === undefined) return;

    const newStatus = parseStatus(status);
    const oldStatus = parseStatus(task.status);

    if (newStatus === Task.STATUS.DONE && oldStatus !== Task.STATUS.DONE) {
        taskAttributes.completed_at = new Date();
    } else if (
        newStatus !== Task.STATUS.DONE &&
        oldStatus === Task.STATUS.DONE
    ) {
        taskAttributes.completed_at = null;
    }
}

module.exports = {
    handleCompletionStatus,
};
