const { AppError } = require('../../../shared/errors/AppError');
const logger = require('../../../services/logService');
const PullPhase = require('./pull-phase');
const MergePhase = require('./merge-phase');
const PushPhase = require('./push-phase');
const SyncStateRepository = require('../repositories/sync-state-repository');
const CalendarRepository = require('../repositories/calendar-repository');

class SyncEngine {
    constructor() {
        this.pullPhase = new PullPhase();
        this.mergePhase = new MergePhase();
        this.pushPhase = new PushPhase();
    }

    async syncCalendar(calendarId, userId, options = {}) {
        const {
            direction = 'bidirectional',
            force = false,
            dryRun = false,
        } = options;

        logger.logInfo(
            `Starting sync for calendar ${calendarId}, direction: ${direction}`
        );

        const calendar = await CalendarRepository.findById(calendarId);
        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        if (!calendar.enabled && !force) {
            logger.logInfo(`Calendar ${calendarId} is disabled, skipping sync`);
            return {
                success: true,
                skipped: true,
                reason: 'Calendar disabled',
            };
        }

        const syncResult = {
            calendarId,
            userId,
            direction,
            dryRun,
            startTime: new Date(),
            phases: {},
            stats: {
                pulled: 0,
                pushed: 0,
                conflicts: 0,
                errors: 0,
            },
        };

        try {
            if (direction === 'pull' || direction === 'bidirectional') {
                logger.logInfo(
                    `Starting pull phase for calendar ${calendarId}`
                );
                const pullResult = await this.pullPhase.execute(
                    calendar,
                    userId,
                    { dryRun }
                );
                syncResult.phases.pull = pullResult;
                syncResult.stats.pulled = pullResult.changedTasks?.length || 0;
            }

            if (direction === 'pull' || direction === 'bidirectional') {
                logger.logInfo(
                    `Starting merge phase for calendar ${calendarId}`
                );
                const mergeResult = await this.mergePhase.execute(
                    calendar,
                    syncResult.phases.pull?.changedTasks || [],
                    { dryRun }
                );
                syncResult.phases.merge = mergeResult;
                syncResult.stats.conflicts = mergeResult.conflicts?.length || 0;
            }

            if (direction === 'push' || direction === 'bidirectional') {
                logger.logInfo(
                    `Starting push phase for calendar ${calendarId}`
                );
                const pushResult = await this.pushPhase.execute(
                    calendar,
                    userId,
                    { dryRun }
                );
                syncResult.phases.push = pushResult;
                syncResult.stats.pushed = pushResult.pushedTasks?.length || 0;
            }

            syncResult.success = true;
            syncResult.endTime = new Date();
            syncResult.duration =
                syncResult.endTime - syncResult.startTime + 'ms';

            if (!dryRun) {
                await CalendarRepository.updateSyncStatus(
                    calendarId,
                    'success',
                    null
                );
            }

            logger.logInfo(
                `Sync completed for calendar ${calendarId}: ${syncResult.stats.pulled} pulled, ${syncResult.stats.pushed} pushed, ${syncResult.stats.conflicts} conflicts`
            );

            return syncResult;
        } catch (error) {
            syncResult.success = false;
            syncResult.error = error.message;
            syncResult.endTime = new Date();

            logger.logError(
                `Sync failed for calendar ${calendarId}: ${error.message}`,
                error
            );

            if (!dryRun) {
                await CalendarRepository.updateSyncStatus(
                    calendarId,
                    'error',
                    error.message
                );
            }

            throw error;
        }
    }

    async syncAllCalendars(userId, options = {}) {
        logger.logInfo(`Starting sync for all calendars for user ${userId}`);

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
                const result = await this.syncCalendar(
                    calendar.id,
                    userId,
                    options
                );
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

    async getSyncStatus(calendarId, userId) {
        const calendar = await CalendarRepository.findById(calendarId);
        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        const conflicts = await this.mergePhase.getConflicts(calendarId);

        return {
            calendarId,
            enabled: calendar.enabled,
            last_sync_at: calendar.last_sync_at,
            last_sync_status: calendar.last_sync_status,
            sync_direction: calendar.sync_direction,
            sync_interval_minutes: calendar.sync_interval_minutes,
            conflicts: conflicts.length,
            conflictDetails: conflicts,
        };
    }
}

module.exports = new SyncEngine();
