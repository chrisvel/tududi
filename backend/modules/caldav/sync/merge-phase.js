const { AppError } = require('../../../shared/errors/AppError');
const logger = require('../../../services/logService');
const { Task } = require('../../../models');
const SyncStateRepository = require('../repositories/sync-state-repository');
const CalendarRepository = require('../repositories/calendar-repository');
const ConflictResolver = require('./conflict-resolver');
const { uid: generateUid } = require('../../../utils/uid');

class MergePhase {
    async execute(calendar, changedTasks, options = {}) {
        const { dryRun = false } = options;

        logger.logInfo(
            `Merge phase starting for calendar ${calendar.id} with ${changedTasks.length} changed tasks`
        );

        const results = {
            merged: [],
            conflicts: [],
            deleted: [],
            errors: [],
        };

        for (const change of changedTasks) {
            try {
                if (change.action === 'delete') {
                    await this._handleDeletion(
                        change,
                        calendar,
                        dryRun,
                        results
                    );
                } else if (change.action === 'create_or_update') {
                    await this._handleCreateOrUpdate(
                        change,
                        calendar,
                        dryRun,
                        results
                    );
                }
            } catch (error) {
                logger.logError(
                    `Failed to merge task ${change.href}: ${error.message}`,
                    error
                );
                results.errors.push({
                    href: change.href,
                    error: error.message,
                });
            }
        }

        logger.logInfo(
            `Merge phase completed: ${results.merged.length} merged, ${results.conflicts.length} conflicts, ${results.deleted.length} deleted, ${results.errors.length} errors`
        );

        return results;
    }

    async _handleDeletion(change, calendar, dryRun, results) {
        const uid = this._extractUidFromHref(change.href);
        const existingTask = await Task.findOne({
            where: { uid, user_id: calendar.user_id },
        });

        if (!existingTask) {
            logger.logInfo(
                `Task ${uid} already deleted or doesn't exist, skipping`
            );
            return;
        }

        const syncState = await SyncStateRepository.findByTaskAndCalendar(
            existingTask.id,
            calendar.id
        );

        if (syncState && existingTask.updated_at > syncState.last_synced_at) {
            logger.logInfo(
                `Task ${uid} was modified locally after remote deletion, conflict detected`
            );

            if (!dryRun) {
                await SyncStateRepository.markConflict(
                    existingTask.id,
                    calendar.id,
                    existingTask.toJSON(),
                    null
                );
            }

            results.conflicts.push({
                uid,
                taskId: existingTask.id,
                type: 'remote_deleted_local_modified',
            });
            return;
        }

        if (!dryRun) {
            await existingTask.destroy();
            await SyncStateRepository.deleteByTaskId(existingTask.id);
        }

        results.deleted.push({ uid, taskId: existingTask.id });
        logger.logInfo(`Task ${uid} deleted`);
    }

    async _handleCreateOrUpdate(change, calendar, dryRun, results) {
        const { task: remoteTask, etag, href } = change;

        // Ensure the remote task has a UID. Some CalDAV servers may omit the
        // UID property (protocol violation) — assign a Tududi-generated one so
        // the task can still be stored and accessed.
        if (!remoteTask.uid) {
            remoteTask.uid = generateUid();
            logger.logInfo(
                `Remote task from ${href} had no UID; assigned ${remoteTask.uid}`
            );
        }

        // Tasks with no name cannot be stored. Use the href filename as a
        // fallback so the task is still created rather than silently dropped.
        if (!remoteTask.name) {
            const hrefBasename = href
                ? href
                      .replace(/\.ics$/i, '')
                      .split('/')
                      .pop()
                : null;
            remoteTask.name = hrefBasename || 'Untitled';
            logger.logInfo(
                `Remote task ${remoteTask.uid} had no name; using fallback "${remoteTask.name}"`
            );
        }

        const existingTask = await Task.findOne({
            where: { uid: remoteTask.uid, user_id: calendar.user_id },
        });

        if (!existingTask) {
            await this._createNewTask(
                remoteTask,
                calendar,
                etag,
                dryRun,
                results
            );
            return;
        }

        const syncState = await SyncStateRepository.findByTaskAndCalendar(
            existingTask.id,
            calendar.id
        );

        if (!syncState) {
            await this._createNewTask(
                remoteTask,
                calendar,
                etag,
                dryRun,
                results,
                existingTask
            );
            return;
        }

        if (syncState.etag === etag) {
            logger.logInfo(
                `Task ${remoteTask.uid} unchanged (ETag match), skipping`
            );
            return;
        }

        const locallyModified =
            existingTask.updated_at > syncState.last_synced_at;
        const remotelyModified = syncState.etag !== etag;

        if (locallyModified && remotelyModified) {
            await this._handleConflict(
                existingTask,
                remoteTask,
                calendar,
                etag,
                dryRun,
                results
            );
            return;
        }

        if (remotelyModified) {
            await this._updateTaskFromRemote(
                existingTask,
                remoteTask,
                calendar,
                etag,
                dryRun,
                results
            );
        }
    }

    // Returns a plain object with only the fields that the Task model accepts,
    // with values clamped to valid ranges so that no Sequelize validation error
    // is raised for otherwise well-formed CalDAV data.
    _sanitizeRemoteTask(remoteTask) {
        const {
            uid,
            name,
            note,
            due_date,
            defer_until,
            reminder_at,
            completed_at,
            status,
            priority,
            recurrence_type,
            recurrence_interval,
            recurrence_end_date,
            recurrence_weekdays,
            recurrence_month_day,
            recurrence_weekday,
            recurrence_week_of_month,
            completion_based,
            habit_mode,
            habit_current_streak,
            habit_total_completions,
            order,
        } = remoteTask;

        // Clamp week_of_month: -1 means "last week" and is valid per iCalendar
        // BYDAY semantics.  The model allows -1 through 5.
        const safeWeekOfMonth =
            recurrence_week_of_month !== null &&
            recurrence_week_of_month !== undefined
                ? Math.max(-1, Math.min(5, recurrence_week_of_month))
                : null;

        // Clamp month_day: -1 means "last day", 1–31 are regular days.
        const safeMonthDay =
            recurrence_month_day !== null && recurrence_month_day !== undefined
                ? Math.max(-1, Math.min(31, recurrence_month_day))
                : null;

        return {
            uid,
            name,
            note,
            due_date,
            defer_until,
            reminder_at,
            completed_at,
            status: status ?? 0,
            priority: priority ?? 0,
            recurrence_type: recurrence_type || 'none',
            recurrence_interval,
            recurrence_end_date,
            recurrence_weekdays,
            recurrence_month_day: safeMonthDay,
            recurrence_weekday,
            recurrence_week_of_month: safeWeekOfMonth,
            completion_based: completion_based ?? false,
            habit_mode: habit_mode ?? false,
            habit_current_streak: habit_current_streak ?? 0,
            habit_total_completions: habit_total_completions ?? 0,
            order,
        };
    }

    async _createNewTask(
        remoteTask,
        calendar,
        etag,
        dryRun,
        results,
        existingTask = null
    ) {
        if (dryRun) {
            results.merged.push({
                uid: remoteTask.uid,
                action: 'create',
                dryRun: true,
            });
            return;
        }

        const taskData = this._sanitizeRemoteTask(remoteTask);

        let task;
        if (existingTask) {
            await existingTask.update({
                ...taskData,
                uid: existingTask.uid,
                user_id: calendar.user_id,
            });
            task = existingTask;
        } else {
            task = await Task.create({
                ...taskData,
                user_id: calendar.user_id,
            });
        }

        await SyncStateRepository.createOrUpdate(task.id, calendar.id, {
            etag,
            last_modified: new Date(),
            last_synced_at: new Date(),
            sync_status: 'synced',
        });

        results.merged.push({
            uid: remoteTask.uid,
            taskId: task.id,
            action: 'create',
        });

        logger.logInfo(`Task ${remoteTask.uid} created from remote`);
    }

    async _updateTaskFromRemote(
        existingTask,
        remoteTask,
        calendar,
        etag,
        dryRun,
        results
    ) {
        if (dryRun) {
            results.merged.push({
                uid: remoteTask.uid,
                taskId: existingTask.id,
                action: 'update',
                dryRun: true,
            });
            return;
        }

        await existingTask.update({
            ...this._sanitizeRemoteTask(remoteTask),
            id: existingTask.id,
            uid: existingTask.uid,
            user_id: existingTask.user_id,
        });

        await SyncStateRepository.createOrUpdate(existingTask.id, calendar.id, {
            etag,
            last_modified: new Date(),
            last_synced_at: new Date(),
            sync_status: 'synced',
        });

        results.merged.push({
            uid: remoteTask.uid,
            taskId: existingTask.id,
            action: 'update',
        });

        logger.logInfo(`Task ${remoteTask.uid} updated from remote`);
    }

    async _handleConflict(
        existingTask,
        remoteTask,
        calendar,
        etag,
        dryRun,
        results
    ) {
        logger.logInfo(
            `Conflict detected for task ${existingTask.uid}: both local and remote modified`
        );

        const resolutionStrategy =
            calendar.conflict_resolution || 'last_write_wins';

        const resolved = await ConflictResolver.resolve(
            existingTask,
            remoteTask,
            resolutionStrategy
        );

        if (resolved.strategy === 'manual') {
            if (!dryRun) {
                await SyncStateRepository.markConflict(
                    existingTask.id,
                    calendar.id,
                    existingTask.toJSON(),
                    remoteTask
                );
            }

            results.conflicts.push({
                uid: existingTask.uid,
                taskId: existingTask.id,
                type: 'both_modified',
                strategy: 'manual',
            });

            logger.logInfo(
                `Task ${existingTask.uid} conflict marked for manual resolution`
            );
            return;
        }

        if (!dryRun) {
            await existingTask.update(resolved.taskData);

            await SyncStateRepository.createOrUpdate(
                existingTask.id,
                calendar.id,
                {
                    etag,
                    last_modified: new Date(),
                    last_synced_at: new Date(),
                    sync_status: 'synced',
                }
            );
        }

        results.merged.push({
            uid: existingTask.uid,
            taskId: existingTask.id,
            action: 'conflict_resolved',
            strategy: resolved.strategy,
        });

        logger.logInfo(
            `Task ${existingTask.uid} conflict resolved using strategy: ${resolved.strategy}`
        );
    }

    async getConflicts(calendarId) {
        return await SyncStateRepository.findConflicts(calendarId);
    }

    async resolveConflict(taskId, calendarId, resolution) {
        const conflict = await SyncStateRepository.findByTaskAndCalendar(
            taskId,
            calendarId
        );

        if (!conflict || conflict.sync_status !== 'conflict') {
            throw new AppError('No conflict found for this task', 404);
        }

        const task = await Task.findByPk(taskId);
        if (!task) {
            throw new AppError('Task not found', 404);
        }

        let taskData;
        if (resolution === 'local') {
            taskData = conflict.conflict_local_version;
        } else if (resolution === 'remote') {
            taskData = conflict.conflict_remote_version;
        } else {
            throw new AppError('Invalid resolution strategy', 400);
        }

        await task.update(taskData);

        await SyncStateRepository.resolveConflict(taskId, calendarId);

        logger.logInfo(
            `Conflict resolved for task ${taskId} using ${resolution} version`
        );

        return task;
    }

    _extractUidFromHref(href) {
        const match = href.match(/([^/]+)\.ics$/);
        return match ? match[1] : href;
    }
}

module.exports = MergePhase;
