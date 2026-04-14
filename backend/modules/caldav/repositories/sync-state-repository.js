const BaseRepository = require('../../../shared/database/BaseRepository');
const { CalDAVSyncState } = require('../../../models');

class SyncStateRepository extends BaseRepository {
    constructor() {
        super(CalDAVSyncState);
    }

    async findByTaskId(taskId, options = {}) {
        return this.findAll({ task_id: taskId }, options);
    }

    async findByCalendarId(calendarId, options = {}) {
        return this.findAll({ calendar_id: calendarId }, options);
    }

    async findByTaskAndCalendar(taskId, calendarId, options = {}) {
        return this.findOne({ task_id: taskId, calendar_id: calendarId }, options);
    }

    async findByETag(etag, options = {}) {
        return this.findOne({ etag }, options);
    }

    async findConflicts(calendarId = null, options = {}) {
        const where = { sync_status: 'conflict' };
        if (calendarId) {
            where.calendar_id = calendarId;
        }
        return this.findAll(where, options);
    }

    async createOrUpdate(taskId, calendarId, data, options = {}) {
        const existing = await this.findByTaskAndCalendar(taskId, calendarId);

        if (existing) {
            return this.update(existing, data, options);
        }

        return this.create(
            {
                task_id: taskId,
                calendar_id: calendarId,
                ...data,
            },
            options
        );
    }

    async updateETag(taskId, calendarId, etag, options = {}) {
        const syncState = await this.findByTaskAndCalendar(taskId, calendarId);
        if (!syncState) {
            throw new Error(
                `Sync state not found for task ${taskId} and calendar ${calendarId}`
            );
        }

        return this.update(
            syncState,
            {
                etag,
                last_modified: new Date(),
            },
            options
        );
    }

    async markSynced(taskId, calendarId, options = {}) {
        const syncState = await this.findByTaskAndCalendar(taskId, calendarId);
        if (!syncState) {
            throw new Error(
                `Sync state not found for task ${taskId} and calendar ${calendarId}`
            );
        }

        return this.update(
            syncState,
            {
                sync_status: 'synced',
                last_synced_at: new Date(),
                conflict_local_version: null,
                conflict_remote_version: null,
                conflict_detected_at: null,
            },
            options
        );
    }

    async markConflict(
        taskId,
        calendarId,
        localVersion,
        remoteVersion,
        options = {}
    ) {
        const syncState = await this.findByTaskAndCalendar(taskId, calendarId);
        if (!syncState) {
            throw new Error(
                `Sync state not found for task ${taskId} and calendar ${calendarId}`
            );
        }

        return this.update(
            syncState,
            {
                sync_status: 'conflict',
                conflict_local_version: localVersion,
                conflict_remote_version: remoteVersion,
                conflict_detected_at: new Date(),
            },
            options
        );
    }

    async resolveConflict(taskId, calendarId, resolution, options = {}) {
        const syncState = await this.findByTaskAndCalendar(taskId, calendarId);
        if (!syncState) {
            throw new Error(
                `Sync state not found for task ${taskId} and calendar ${calendarId}`
            );
        }

        return this.update(
            syncState,
            {
                sync_status: 'synced',
                conflict_local_version: null,
                conflict_remote_version: null,
                conflict_detected_at: null,
                last_synced_at: new Date(),
            },
            options
        );
    }
}

module.exports = new SyncStateRepository();
