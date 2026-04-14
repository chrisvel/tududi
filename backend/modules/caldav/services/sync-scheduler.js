const cron = require('node-cron');
const logger = require('../../../services/logService');
const syncEngine = require('../sync/sync-engine');
const CalendarRepository = require('../repositories/calendar-repository');
const RemoteCalendarRepository = require('../repositories/remote-calendar-repository');

class SyncScheduler {
    constructor() {
        this.jobs = new Map();
        this.isInitialized = false;
        this.globalJob = null;
    }

    async initialize() {
        if (this.isInitialized) {
            logger.logInfo('CalDAV sync scheduler already initialized');
            return;
        }

        const enabled = process.env.CALDAV_ENABLED !== 'false';
        if (!enabled) {
            logger.logInfo('CalDAV sync scheduler disabled via CALDAV_ENABLED');
            return;
        }

        logger.logInfo('Initializing CalDAV sync scheduler');

        const syncIntervalMinutes = parseInt(
            process.env.CALDAV_DEFAULT_SYNC_INTERVAL || '15',
            10
        );

        const cronExpression = this._getCronExpression(syncIntervalMinutes);

        this.globalJob = cron.schedule(cronExpression, async () => {
            await this.syncAllDueCalendars();
        });

        this.isInitialized = true;
        logger.logInfo(
            `CalDAV sync scheduler initialized with ${syncIntervalMinutes} minute interval`
        );
    }

    async syncAllDueCalendars() {
        try {
            logger.logInfo('Starting scheduled sync for all due calendars');

            const dueCalendars = await CalendarRepository.findDueForSync();

            logger.logInfo(
                `Found ${dueCalendars.length} calendars due for sync`
            );

            for (const calendar of dueCalendars) {
                try {
                    await this._syncCalendar(calendar);
                } catch (error) {
                    logger.logError(
                        `Failed to sync calendar ${calendar.id}: ${error.message}`,
                        error
                    );
                }
            }

            logger.logInfo('Completed scheduled sync for all due calendars');
        } catch (error) {
            logger.logError(
                `Error during scheduled sync: ${error.message}`,
                error
            );
        }
    }

    async _syncCalendar(calendar) {
        try {
            logger.logInfo(
                `Syncing calendar ${calendar.id} for user ${calendar.user_id}`
            );

            const result = await syncEngine.syncCalendar(
                calendar.id,
                calendar.user_id,
                {
                    direction: calendar.sync_direction || 'bidirectional',
                }
            );

            if (result.success) {
                logger.logInfo(
                    `Successfully synced calendar ${calendar.id}: ${result.stats.pulled} pulled, ${result.stats.pushed} pushed, ${result.stats.conflicts} conflicts`
                );
            } else {
                logger.logWarn(
                    `Sync completed with errors for calendar ${calendar.id}`
                );
            }

            return result;
        } catch (error) {
            logger.logError(
                `Failed to sync calendar ${calendar.id}: ${error.message}`,
                error
            );

            await CalendarRepository.updateSyncStatus(
                calendar.id,
                'error',
                error.message
            );

            throw error;
        }
    }

    async syncCalendarById(calendarId, userId, options = {}) {
        const calendar = await CalendarRepository.findById(calendarId);

        if (!calendar) {
            throw new Error(`Calendar ${calendarId} not found`);
        }

        if (calendar.user_id !== userId) {
            throw new Error('Unauthorized access to calendar');
        }

        return await this._syncCalendar(calendar);
    }

    async syncUserCalendars(userId, options = {}) {
        logger.logInfo(`Syncing all calendars for user ${userId}`);

        const calendars = await CalendarRepository.findByUserId(userId);
        const results = [];

        for (const calendar of calendars) {
            if (!calendar.enabled && !options.force) {
                logger.logInfo(
                    `Skipping disabled calendar ${calendar.id} for user ${userId}`
                );
                continue;
            }

            try {
                const result = await this._syncCalendar(calendar);
                results.push(result);
            } catch (error) {
                logger.logError(
                    `Failed to sync calendar ${calendar.id}: ${error.message}`,
                    error
                );
                results.push({
                    calendarId: calendar.id,
                    success: false,
                    error: error.message,
                });
            }
        }

        return {
            userId,
            totalCalendars: calendars.length,
            syncedCalendars: results.filter((r) => r.success).length,
            failedCalendars: results.filter((r) => !r.success).length,
            results,
        };
    }

    _getCronExpression(minutes) {
        if (minutes < 1 || minutes > 1440) {
            throw new Error(
                'Sync interval must be between 1 and 1440 minutes (24 hours)'
            );
        }

        if (minutes === 1) {
            return '* * * * *';
        }

        if (60 % minutes === 0) {
            return `*/${minutes} * * * *`;
        }

        return `0 */${Math.floor(minutes / 60)} * * *`;
    }

    async shutdown() {
        logger.logInfo('Shutting down CalDAV sync scheduler');

        if (this.globalJob) {
            this.globalJob.stop();
            this.globalJob = null;
        }

        for (const [calendarId, job] of this.jobs.entries()) {
            job.stop();
            this.jobs.delete(calendarId);
        }

        this.isInitialized = false;
        logger.logInfo('CalDAV sync scheduler shut down');
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            activeJobs: this.jobs.size,
            globalJobActive: this.globalJob !== null,
        };
    }
}

module.exports = new SyncScheduler();
