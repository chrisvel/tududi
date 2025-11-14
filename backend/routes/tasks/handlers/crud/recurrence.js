const { Task } = require('../../../../models');

async function handleRecurrenceUpdate(task, recurrenceFields, reqBody, userId) {
    const recurrenceChanged = recurrenceFields.some((field) => {
        const newValue = reqBody[field];
        return newValue !== undefined && newValue !== task[field];
    });

    if (!recurrenceChanged || task.recurrence_type === 'none') {
        return false;
    }

    const childTasks = await Task.findAll({
        where: { recurring_parent_id: task.id },
    });

    if (childTasks.length > 0) {
        const now = new Date();
        const futureInstances = childTasks.filter((child) => {
            if (!child.due_date) return true;
            return new Date(child.due_date) > now;
        });

        const newRecurrenceType =
            reqBody.recurrence_type !== undefined
                ? reqBody.recurrence_type
                : task.recurrence_type;

        if (newRecurrenceType !== 'none') {
            for (const futureInstance of futureInstances) {
                await futureInstance.destroy();
            }
        }
    }

    return recurrenceChanged;
}

module.exports = {
    handleRecurrenceUpdate,
};
