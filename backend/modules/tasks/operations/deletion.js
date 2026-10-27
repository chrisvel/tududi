const { TaskEvent, TaskAttachment, sequelize } = require('../../../models');
const taskRepository = require('../repository');
const { deleteAttachmentFiles } = require('../../../utils/attachment-utils');
const { withForeignKeyChecksDisabled } = require('../../../utils/db-dialect');
const { logError } = require('../../../services/logService');

// Removes one task row and everything that hangs off it. Recurring instances
// are the caller's business; `task` must come with its Attachments loaded.
// `skipWebhooks` keeps a bulk caller (undoing an import) from sending one
// task.deleted per row.
async function destroyTaskRows(task, { skipWebhooks = false } = {}) {
    const taskId = task.id;

    // Before the row goes away, so the remote copy does not survive to be
    // pulled back in as a new task on the next sync (#1371). Required lazily
    // because the CalDAV module already depends on this one.
    try {
        const {
            deleteTaskFromRemotes,
        } = require('../../caldav/services/task-deletion-service');
        await deleteTaskFromRemotes(task);
    } catch (error) {
        logError('Error removing task from CalDAV remotes:', error);
    }

    // Dependent rows are removed in dependency order below, which is
    // what PostgreSQL relies on; older SQLite databases additionally get
    // constraint checks switched off for the duration.
    await withForeignKeyChecksDisabled(sequelize, async () => {
        await TaskEvent.destroy({
            where: { task_id: taskId },
            force: true,
        });

        await sequelize.query('DELETE FROM tasks_tags WHERE task_id = ?', {
            replacements: [taskId],
        });

        await sequelize.query(
            'DELETE FROM task_relations WHERE source_task_id = ? OR target_task_id = ?',
            { replacements: [taskId, taskId] }
        );

        await sequelize.query(
            'DELETE FROM user_task_orders WHERE task_id = ?',
            { replacements: [taskId] }
        );

        await taskRepository.clearRecurringParent(taskId);

        // Unlink attachment files from disk before destroying rows, so a
        // dangling file never outlives the record that gated its access
        // (GHSA-43p8-ch4p-gqg4).
        await deleteAttachmentFiles(task.Attachments);
        await TaskAttachment.destroy({
            where: { task_id: taskId },
            force: true,
        });

        await task.destroy({ force: true, skipWebhooks });
    });
}

module.exports = { destroyTaskRows };
