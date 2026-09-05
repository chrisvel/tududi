const path = require('path');
const fs = require('fs').promises;
const { Op } = require('sequelize');
const {
    sequelize,
    User,
    Role,
    Area,
    Goal,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    TaskEvent,
    Action,
    Permission,
    View,
    ApiToken,
    Notification,
    RecurringCompletion,
    TaskAttachment,
    Backup,
    OIDCIdentity,
    AuthAuditLog,
    CalDAVCalendar,
    CalDAVSyncState,
    CalDAVOccurrenceOverride,
    CalDAVRemoteCalendar,
    CalendarToken,
    Person,
    UserProjectArea,
} = require('../models');
const { getConfig } = require('../config/config');
const { getBackupsDirectory } = require('./backupService');
const { destroyUserSessions } = require('./sessionService');
const { logError } = require('./logService');

const config = getConfig();

// Deletes a file only if it lives under `baseDir`; a bad path in the
// database must not turn into an arbitrary unlink.
async function unlinkWithin(baseDir, relativeOrAbsolute) {
    if (!relativeOrAbsolute) return;
    const resolvedBase = path.resolve(baseDir);
    const resolved = path.resolve(resolvedBase, relativeOrAbsolute);
    const relative = path.relative(resolvedBase, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        logError('Refusing to delete file outside its directory:', resolved);
        return;
    }
    await fs.unlink(resolved).catch(() => {});
}

// Removes every row that belongs to a user, and every file those rows
// point at. Used for admin deletion and for self-service account deletion.
// Rows go inside one transaction; files are removed only after it commits,
// so a rollback never leaves rows pointing at missing files.
async function eraseUserAccount(userId) {
    const filesToDelete = [];
    const transaction = await sequelize.transaction();

    try {
        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            await transaction.rollback();
            return false;
        }

        const tx = { transaction };
        const byUser = { where: { user_id: userId }, ...tx };

        const attachments = await TaskAttachment.findAll({
            where: { user_id: userId },
            attributes: ['file_path'],
            raw: true,
            ...tx,
        });
        for (const a of attachments) {
            filesToDelete.push([config.uploadPath, a.file_path]);
        }

        const backups = await Backup.findAll({
            where: { user_id: userId },
            attributes: ['file_path'],
            raw: true,
            ...tx,
        });
        if (backups.length > 0) {
            const backupsDir = await getBackupsDirectory();
            for (const b of backups) {
                filesToDelete.push([backupsDir, b.file_path]);
            }
        }

        if (user.avatar_image) {
            filesToDelete.push([
                path.join(config.uploadPath, 'avatars'),
                path.basename(user.avatar_image),
            ]);
        }

        const userTasks = await Task.findAll({
            where: { user_id: userId },
            attributes: ['id'],
            raw: true,
            ...tx,
        });
        const taskIds = userTasks.map((t) => t.id);
        if (taskIds.length > 0) {
            await RecurringCompletion.destroy({
                where: { task_id: taskIds },
                ...tx,
            });
        }

        const calendars = await CalDAVCalendar.findAll({
            where: { user_id: userId },
            attributes: ['id'],
            raw: true,
            ...tx,
        });
        const calendarIds = calendars.map((c) => c.id);
        if (calendarIds.length > 0) {
            await CalDAVSyncState.destroy({
                where: { calendar_id: calendarIds },
                ...tx,
            });
            await CalDAVOccurrenceOverride.destroy({
                where: { calendar_id: calendarIds },
                ...tx,
            });
        }
        await CalDAVRemoteCalendar.destroy(byUser);
        await CalDAVCalendar.destroy(byUser);
        await CalendarToken.destroy(byUser);

        await TaskEvent.destroy(byUser);
        await TaskAttachment.destroy(byUser);
        await Task.destroy(byUser);
        await Note.destroy(byUser);
        await UserProjectArea.destroy(byUser);
        await Project.destroy(byUser);
        await Goal.destroy(byUser);
        await Area.destroy(byUser);
        await Tag.destroy(byUser);
        await InboxItem.destroy(byUser);
        await View.destroy(byUser);
        await Notification.destroy(byUser);
        await ApiToken.destroy(byUser);
        await Backup.destroy(byUser);
        await OIDCIdentity.destroy(byUser);
        await AuthAuditLog.destroy(byUser);

        // Other people's contact cards that pointed at this account keep
        // their own data but lose the link.
        await Person.update(
            { linked_user_id: null },
            { where: { linked_user_id: userId }, ...tx }
        );
        await Person.destroy(byUser);

        await Permission.destroy({
            where: {
                [Op.or]: [{ user_id: userId }, { granted_by_user_id: userId }],
            },
            ...tx,
        });
        await Action.destroy({
            where: {
                [Op.or]: [
                    { actor_user_id: userId },
                    { target_user_id: userId },
                ],
            },
            ...tx,
        });

        await Role.destroy(byUser);
        await user.destroy(tx);

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }

    await destroyUserSessions(userId);
    for (const [baseDir, file] of filesToDelete) {
        await unlinkWithin(baseDir, file);
    }

    return true;
}

module.exports = { eraseUserAccount };
