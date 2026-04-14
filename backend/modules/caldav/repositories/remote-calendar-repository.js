const BaseRepository = require('../../../shared/database/BaseRepository');
const { CalDAVRemoteCalendar } = require('../../../models');

class RemoteCalendarRepository extends BaseRepository {
    constructor() {
        super(CalDAVRemoteCalendar);
    }

    async findByUserId(userId, options = {}) {
        return this.findAll({ user_id: userId }, options);
    }

    async findEnabledByUserId(userId, options = {}) {
        return this.findAll({ user_id: userId, enabled: true }, options);
    }

    async findByLocalCalendarId(localCalendarId, options = {}) {
        return this.findOne({ local_calendar_id: localCalendarId }, options);
    }

    async findDueForSync(options = {}) {
        const remoteCalendars = await this.findAll({ enabled: true }, options);

        const now = new Date();
        return remoteCalendars.filter((remote) => {
            if (!remote.last_sync_at || !remote.LocalCalendar) {
                return true;
            }

            const syncInterval =
                remote.LocalCalendar.sync_interval_minutes || 15;
            const nextSyncTime = new Date(
                remote.last_sync_at.getTime() + syncInterval * 60 * 1000
            );
            return now >= nextSyncTime;
        });
    }

    async updateSyncStatus(
        remoteCalendarId,
        status,
        error = null,
        options = {}
    ) {
        const remoteCalendar = await this.findById(remoteCalendarId);
        if (!remoteCalendar) {
            throw new Error(
                `Remote calendar ${remoteCalendarId} not found`
            );
        }

        return this.update(
            remoteCalendar,
            {
                last_sync_at: new Date(),
                last_sync_status: status,
                last_sync_error: error,
            },
            options
        );
    }

    async updateServerCTag(remoteCalendarId, ctag, options = {}) {
        const remoteCalendar = await this.findById(remoteCalendarId);
        if (!remoteCalendar) {
            throw new Error(
                `Remote calendar ${remoteCalendarId} not found`
            );
        }

        return this.update(remoteCalendar, { server_ctag: ctag }, options);
    }

    async updateServerSyncToken(remoteCalendarId, syncToken, options = {}) {
        const remoteCalendar = await this.findById(remoteCalendarId);
        if (!remoteCalendar) {
            throw new Error(
                `Remote calendar ${remoteCalendarId} not found`
            );
        }

        return this.update(
            remoteCalendar,
            { server_sync_token: syncToken },
            options
        );
    }
}

module.exports = new RemoteCalendarRepository();
