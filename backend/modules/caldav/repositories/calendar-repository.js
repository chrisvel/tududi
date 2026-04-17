const BaseRepository = require('../../../shared/database/BaseRepository');
const { CalDAVCalendar } = require('../../../models');

class CalendarRepository extends BaseRepository {
    constructor() {
        super(CalDAVCalendar);
    }

    async findByUserId(userId, options = {}) {
        return this.findAll({ user_id: userId }, options);
    }

    async findEnabledByUserId(userId, options = {}) {
        return this.findAll({ user_id: userId, enabled: true }, options);
    }

    async findByUid(uid, options = {}) {
        return this.findOne({ uid }, options);
    }

    async findDueForSync(options = {}) {
        const now = new Date();
        const calendars = await this.model.findAll({
            where: {
                enabled: true,
            },
            ...options,
        });

        return calendars.filter((calendar) => {
            if (!calendar.last_sync_at) {
                return true;
            }

            const nextSyncTime = new Date(
                calendar.last_sync_at.getTime() +
                    calendar.sync_interval_minutes * 60 * 1000
            );
            return now >= nextSyncTime;
        });
    }

    async updateSyncStatus(calendarId, status, error = null, options = {}) {
        const calendar = await this.findById(calendarId);
        if (!calendar) {
            throw new Error(`Calendar ${calendarId} not found`);
        }

        return this.update(
            calendar,
            {
                last_sync_at: new Date(),
                last_sync_status: status,
                ...(error && { last_sync_error: error }),
            },
            options
        );
    }

    async updateCTag(calendarId, ctag, options = {}) {
        const calendar = await this.findById(calendarId);
        if (!calendar) {
            throw new Error(`Calendar ${calendarId} not found`);
        }

        return this.update(calendar, { ctag }, options);
    }

    async updateSyncToken(calendarId, syncToken, options = {}) {
        const calendar = await this.findById(calendarId);
        if (!calendar) {
            throw new Error(`Calendar ${calendarId} not found`);
        }

        return this.update(calendar, { sync_token: syncToken }, options);
    }
}

module.exports = new CalendarRepository();
