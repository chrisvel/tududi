const axios = require('axios');
const { AppError } = require('../../../shared/errors/AppError');
const logger = require('../../../services/logService');
const { Task } = require('../../../models');
const SyncStateRepository = require('../repositories/sync-state-repository');
const RemoteCalendarRepository = require('../repositories/remote-calendar-repository');
const { serializeTaskToVTODO } = require('../icalendar/vtodo-serializer');
const encryptionService = require('../services/encryption-service');

class PushPhase {
    async execute(calendar, userId, options = {}) {
        const { dryRun = false } = options;

        logger.logInfo(
            `Push phase starting for calendar ${calendar.id} (user: ${userId})`
        );

        const remoteCalendar =
            await RemoteCalendarRepository.findByLocalCalendarId(calendar.id);

        if (!remoteCalendar) {
            logger.logInfo(
                `No remote calendar configured for calendar ${calendar.id}, skipping push`
            );
            return {
                success: true,
                skipped: true,
                reason: 'No remote calendar configured',
                pushedTasks: [],
            };
        }

        if (!remoteCalendar.enabled) {
            logger.logInfo(
                `Remote calendar ${remoteCalendar.id} is disabled, skipping push`
            );
            return {
                success: true,
                skipped: true,
                reason: 'Remote calendar disabled',
                pushedTasks: [],
            };
        }

        try {
            const changedTasks = await this._findLocalChanges(
                calendar.id,
                userId
            );

            const pushedTasks = [];
            const errors = [];

            for (const task of changedTasks) {
                try {
                    const result = await this._pushTaskToRemote(
                        task,
                        remoteCalendar,
                        calendar,
                        dryRun
                    );
                    pushedTasks.push(result);
                } catch (error) {
                    logger.logError(
                        `Failed to push task ${task.uid}: ${error.message}`,
                        error
                    );
                    errors.push({
                        taskId: task.id,
                        uid: task.uid,
                        error: error.message,
                    });
                }
            }

            logger.logInfo(
                `Push phase completed: pushed ${pushedTasks.length} tasks, ${errors.length} errors`
            );

            return {
                success: true,
                pushedTasks,
                pushedCount: pushedTasks.length,
                errors,
            };
        } catch (error) {
            logger.logError(
                `Push phase failed for calendar ${calendar.id}: ${error.message}`,
                error
            );
            throw new AppError(
                `Failed to push to remote: ${error.message}`,
                500
            );
        }
    }

    async _findLocalChanges(calendarId, userId) {
        const syncStates =
            await SyncStateRepository.findByCalendarId(calendarId);

        const syncedTaskIds = syncStates.map((state) => state.task_id);

        const allTasks = await Task.findAll({
            where: { user_id: userId },
        });

        const changedTasks = [];

        for (const task of allTasks) {
            const syncState = syncStates.find((s) => s.task_id === task.id);

            if (!syncState) {
                changedTasks.push(task);
                continue;
            }

            if (
                syncState.sync_status === 'conflict' ||
                syncState.sync_status === 'pending'
            ) {
                continue;
            }

            if (task.updated_at > syncState.last_synced_at) {
                changedTasks.push(task);
            }
        }

        logger.logInfo(
            `Found ${changedTasks.length} locally modified tasks to push`
        );

        return changedTasks;
    }

    async _pushTaskToRemote(task, remoteCalendar, calendar, dryRun) {
        if (dryRun) {
            return {
                taskId: task.id,
                uid: task.uid,
                action: 'push',
                dryRun: true,
            };
        }

        const password = encryptionService.decrypt(
            remoteCalendar.password_encrypted
        );

        const baseUrl = remoteCalendar.server_url.replace(/\/$/, '');
        const calendarPath = remoteCalendar.calendar_path.replace(/^\//, '');
        const taskUrl = `${baseUrl}/${calendarPath}/${task.uid}.ics`;

        const vtodoString = await serializeTaskToVTODO(task);

        const syncState = await SyncStateRepository.findByTaskAndCalendar(
            task.id,
            calendar.id
        );

        try {
            const headers = {
                'Content-Type': 'text/calendar; charset=utf-8',
            };

            if (syncState?.etag) {
                headers['If-Match'] = syncState.etag;
            }

            const response = await axios({
                method: 'PUT',
                url: taskUrl,
                headers,
                auth: {
                    username: remoteCalendar.username,
                    password: password,
                },
                data: vtodoString,
                timeout: parseInt(
                    process.env.CALDAV_REQUEST_TIMEOUT || '30000',
                    10
                ),
            });

            const newEtag = response.headers.etag?.replace(/^"|"$/g, '');

            await SyncStateRepository.createOrUpdate(task.id, calendar.id, {
                etag: newEtag || syncState?.etag,
                last_modified: new Date(),
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            logger.logInfo(`Task ${task.uid} successfully pushed to remote`);

            return {
                taskId: task.id,
                uid: task.uid,
                action: 'push',
                etag: newEtag,
            };
        } catch (error) {
            if (error.response?.status === 412) {
                logger.logError(
                    `Precondition failed for task ${task.uid}: ETag mismatch, conflict detected`
                );

                await SyncStateRepository.createOrUpdate(task.id, calendar.id, {
                    sync_status: 'conflict',
                });

                throw new AppError(
                    'Conflict detected: task was modified on server',
                    412
                );
            }

            if (error.response?.status === 401) {
                throw new AppError(
                    'Authentication failed with remote CalDAV server',
                    401
                );
            }

            logger.logError(
                `Failed to push task ${task.uid}: ${error.message}`,
                error
            );
            throw error;
        }
    }

    async deleteTaskFromRemote(task, remoteCalendar, calendar, dryRun = false) {
        if (dryRun) {
            return {
                taskId: task.id,
                uid: task.uid,
                action: 'delete',
                dryRun: true,
            };
        }

        const password = encryptionService.decrypt(
            remoteCalendar.password_encrypted
        );

        const baseUrl = remoteCalendar.server_url.replace(/\/$/, '');
        const calendarPath = remoteCalendar.calendar_path.replace(/^\//, '');
        const taskUrl = `${baseUrl}/${calendarPath}/${task.uid}.ics`;

        try {
            await axios({
                method: 'DELETE',
                url: taskUrl,
                auth: {
                    username: remoteCalendar.username,
                    password: password,
                },
                timeout: parseInt(
                    process.env.CALDAV_REQUEST_TIMEOUT || '30000',
                    10
                ),
            });

            await SyncStateRepository.deleteByTaskId(task.id);

            logger.logInfo(`Task ${task.uid} successfully deleted from remote`);

            return {
                taskId: task.id,
                uid: task.uid,
                action: 'delete',
            };
        } catch (error) {
            if (error.response?.status === 404) {
                logger.logInfo(
                    `Task ${task.uid} already deleted from remote, clearing sync state`
                );
                await SyncStateRepository.deleteByTaskId(task.id);
                return {
                    taskId: task.id,
                    uid: task.uid,
                    action: 'delete',
                    alreadyDeleted: true,
                };
            }

            logger.logError(
                `Failed to delete task ${task.uid} from remote: ${error.message}`,
                error
            );
            throw error;
        }
    }
}

module.exports = PushPhase;
