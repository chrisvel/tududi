const { AppError } = require('../../../shared/errors/AppError');
const logger = require('../../../services/logService');
const { Task } = require('../../../models');
const SyncStateRepository = require('../repositories/sync-state-repository');
const CalendarRepository = require('../repositories/calendar-repository');
const ConflictResolver = require('./conflict-resolver');

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

        let task;
        if (existingTask) {
            await existingTask.update({
                ...remoteTask,
                user_id: calendar.user_id,
            });
            task = existingTask;
        } else {
            task = await Task.create({
                ...remoteTask,
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
            ...remoteTask,
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
