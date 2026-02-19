const { User, CalendarEvent } = require('../../models');
const { Op } = require('sequelize');
const { logError, logInfo } = require('../../services/logService');
const icsFetcher = require('./icsFetcher');
const icsParser = require('./icsParser');

const ICS_SOURCE = 'ics';
const RETENTION_PAST_DAYS = 30;
const RETENTION_FUTURE_DAYS = 90;

/**
 * Service to handle calendar sync scheduling and per-user locking
 * Prevents overlapping syncs between scheduler and manual sync
 */

/**
 * Lock duration in milliseconds (5 minutes)
 * If a lock is older than this, it's considered stale and can be overwritten
 */
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Sync preset intervals in milliseconds
 */
const SYNC_PRESETS = {
    '15min': 15 * 60 * 1000,
    '30min': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
};

/**
 * Attempt to acquire a sync lock for a user
 * Uses DB-level conditional update to prevent race conditions across multiple instances
 *
 * @param {number} userId - User ID to lock
 * @returns {Promise<boolean>} - true if lock acquired, false if already locked
 */
async function lockUserSync(userId) {
    try {
        const now = new Date();
        const lockExpiry = new Date(now.getTime() - LOCK_TIMEOUT_MS);

        // Conditional update: only update if lock is null or expired
        // This is atomic at the DB level
        const [affectedRows] = await User.update(
            {
                calendar_settings: require('sequelize').literal(`
                    json_set(
                        calendar_settings,
                        '$.calendar_sync_locked_at',
                        '${now.toISOString()}'
                    )
                `),
            },
            {
                where: {
                    id: userId,
                    [Op.or]: [
                        // Lock is null
                        {
                            calendar_settings: {
                                [Op.or]: [
                                    { calendar_sync_locked_at: null },
                                    {
                                        calendar_sync_locked_at: {
                                            [Op.eq]: null,
                                        },
                                    },
                                ],
                            },
                        },
                        // Lock is expired (older than LOCK_TIMEOUT_MS)
                        require('sequelize').literal(`
                            julianday('now') - julianday(json_extract(calendar_settings, '$.calendar_sync_locked_at')) > ${LOCK_TIMEOUT_MS / (1000 * 60 * 60 * 24)}
                        `),
                    ],
                },
            }
        );

        return affectedRows > 0;
    } catch (error) {
        logError(`Error acquiring lock for user ${userId}:`, error);
        return false;
    }
}

/**
 * Release sync lock for a user
 *
 * @param {number} userId - User ID to unlock
 * @returns {Promise<boolean>} - true if lock released successfully
 */
async function unlockUserSync(userId) {
    try {
        await User.update(
            {
                calendar_settings: require('sequelize').literal(`
                    json_set(
                        calendar_settings,
                        '$.calendar_sync_locked_at',
                        NULL
                    )
                `),
            },
            {
                where: { id: userId },
            }
        );

        return true;
    } catch (error) {
        logError(`Error releasing lock for user ${userId}:`, error);
        return false;
    }
}

/**
 * Calculate if a user is due for sync based on their preset and lastSyncedAt
 *
 * @param {Object} calendarSettings - User's calendar_settings JSON object
 * @returns {boolean} - true if user is due for sync
 */
function isUserDueForSync(calendarSettings) {
    if (!calendarSettings || !calendarSettings.enabled) {
        return false;
    }

    const { syncPreset, lastSyncedAt } = calendarSettings;

    // If never synced, user is due
    if (!lastSyncedAt) {
        return true;
    }

    const intervalMs = SYNC_PRESETS[syncPreset] || SYNC_PRESETS['6h'];
    const lastSync = new Date(lastSyncedAt);
    const now = new Date();
    const timeSinceLastSync = now - lastSync;

    return timeSinceLastSync >= intervalMs;
}

const normalizeCalendarSettings = (calendarSettings) =>
    calendarSettings && typeof calendarSettings === 'object'
        ? calendarSettings
        : {
              enabled: false,
              icsUrl: '',
              syncPreset: '6h',
              lastSyncedAt: null,
              lastSyncError: null,
              etag: null,
              lastModified: null,
          };

const buildRetentionWindow = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const retentionStart = new Date(today);
    retentionStart.setDate(retentionStart.getDate() - RETENTION_PAST_DAYS);

    const retentionEnd = new Date(today);
    retentionEnd.setDate(retentionEnd.getDate() + RETENTION_FUTURE_DAYS);
    retentionEnd.setHours(23, 59, 59, 999);

    return { retentionStart, retentionEnd };
};

const buildEventKey = (event) =>
    `${event.ical_uid}::${new Date(event.starts_at).toISOString()}`;

async function syncUserIcs(userId) {
    const counts = {
        added: 0,
        updated: 0,
        deleted: 0,
        skippedNotModified: 0,
    };

    const user = await User.findByPk(userId, {
        attributes: ['id', 'calendar_settings'],
    });

    if (!user) {
        throw new Error('User not found.');
    }

    const settings = normalizeCalendarSettings(
        typeof user.calendar_settings === 'string'
            ? JSON.parse(user.calendar_settings)
            : user.calendar_settings
    );

    if (!settings.icsUrl) {
        await User.update(
            {
                calendar_settings: {
                    ...settings,
                    lastSyncError: 'No ICS URL configured',
                },
            },
            {
                where: { id: user.id },
            }
        );

        return counts;
    }

    try {
        const fetchResult = await icsFetcher.fetchIcs(settings.icsUrl, {
            etag: settings.etag,
            lastModified: settings.lastModified,
        });

        if (!fetchResult.success) {
            throw new Error(fetchResult.error || 'ICS fetch failed.');
        }

        if (fetchResult.statusCode === 304) {
            await User.update(
                {
                    calendar_settings: {
                        ...settings,
                        lastSyncedAt: new Date().toISOString(),
                        lastSyncError: null,
                        etag: fetchResult.etag || settings.etag,
                        lastModified:
                            fetchResult.lastModified || settings.lastModified,
                    },
                },
                {
                    where: { id: user.id },
                }
            );

            counts.skippedNotModified = 1;
            return counts;
        }

        const parsedEvents = icsParser.parseIcs(fetchResult.data || '');
        const { retentionStart, retentionEnd } = buildRetentionWindow();

        const filteredEvents = parsedEvents.filter((event) => {
            if (!event.ical_uid || !event.starts_at) {
                return false;
            }

            const startsAt = new Date(event.starts_at);
            return startsAt >= retentionStart && startsAt <= retentionEnd;
        });

        const existingEvents = await CalendarEvent.findAll({
            where: {
                user_id: user.id,
                source: ICS_SOURCE,
                starts_at: {
                    [Op.between]: [retentionStart, retentionEnd],
                },
            },
        });

        const existingByKey = new Map();
        existingEvents.forEach((event) => {
            existingByKey.set(buildEventKey(event), event);
        });

        const incomingKeys = new Set();

        for (const event of filteredEvents) {
            const record = {
                user_id: user.id,
                source: ICS_SOURCE,
                ical_uid: event.ical_uid,
                title: event.title,
                starts_at: event.starts_at,
                ends_at: event.ends_at,
                all_day: event.all_day,
                location: event.location,
                description: event.description,
            };

            const key = buildEventKey(record);
            incomingKeys.add(key);

            const existing = existingByKey.get(key);

            if (!existing) {
                await CalendarEvent.create(record);
                counts.added++;
                continue;
            }

            const needsUpdate =
                existing.title !== record.title ||
                (existing.ends_at ? existing.ends_at.getTime() : null) !==
                    (record.ends_at ? record.ends_at.getTime() : null) ||
                existing.all_day !== record.all_day ||
                (existing.location || '') !== (record.location || '') ||
                (existing.description || '') !== (record.description || '');

            if (needsUpdate) {
                await existing.update({
                    title: record.title,
                    ends_at: record.ends_at,
                    all_day: record.all_day,
                    location: record.location,
                    description: record.description,
                });
                counts.updated++;
            }
        }

        const missingIds = existingEvents
            .filter((event) => !incomingKeys.has(buildEventKey(event)))
            .map((event) => event.id);

        if (missingIds.length > 0) {
            const deletedCount = await CalendarEvent.destroy({
                where: {
                    id: {
                        [Op.in]: missingIds,
                    },
                },
            });
            counts.deleted += deletedCount;
        }

        const retentionDeletes = await CalendarEvent.destroy({
            where: {
                user_id: user.id,
                source: ICS_SOURCE,
                [Op.or]: [
                    { starts_at: { [Op.lt]: retentionStart } },
                    { starts_at: { [Op.gt]: retentionEnd } },
                ],
            },
        });

        counts.deleted += retentionDeletes;

        await User.update(
            {
                calendar_settings: {
                    ...settings,
                    lastSyncedAt: new Date().toISOString(),
                    lastSyncError: null,
                    etag: fetchResult.etag || settings.etag,
                    lastModified:
                        fetchResult.lastModified || settings.lastModified,
                },
            },
            {
                where: { id: user.id },
            }
        );

        return counts;
    } catch (error) {
        await User.update(
            {
                calendar_settings: {
                    ...settings,
                    lastSyncError: error.message,
                },
            },
            {
                where: { id: user.id },
            }
        );

        logError(`Error syncing ICS for user ${user.id}:`, error);
        return counts;
    }
}

/**
 * Find all users who are due for calendar sync
 *
 * @returns {Promise<Array>} - Array of users due for sync
 */
async function findDueUsers() {
    try {
        // Get all users with calendar sync enabled
        const users = await User.findAll({
            where: {
                calendar_settings: {
                    [Op.not]: null,
                },
            },
            attributes: ['id', 'email', 'calendar_settings'],
        });

        // Filter to only users who are due for sync
        const dueUsers = users.filter((user) => {
            try {
                const settings =
                    typeof user.calendar_settings === 'string'
                        ? JSON.parse(user.calendar_settings)
                        : user.calendar_settings;

                return isUserDueForSync(settings);
            } catch (error) {
                logError(
                    `Error parsing calendar_settings for user ${user.id}:`,
                    error
                );
                return false;
            }
        });

        return dueUsers;
    } catch (error) {
        logError('Error finding due users:', error);
        throw error;
    }
}

/**
 * Sync calendar for a single user
 * Assumes lock is already acquired
 *
 * @param {Object} user - User object
 * @returns {Promise<Object>} - Sync result
 */
async function syncUserCalendar(user) {
    try {
        const settings =
            typeof user.calendar_settings === 'string'
                ? JSON.parse(user.calendar_settings)
                : user.calendar_settings;

        const { icsUrl } = settings;

        if (!icsUrl) {
            return {
                success: false,
                error: 'No ICS URL configured',
            };
        }

        const fetchResult = await icsFetcher.fetchICS(icsUrl, {
            etag: settings.etag,
            lastModified: settings.lastModified,
        });

        if (fetchResult.notModified) {
            await User.update(
                {
                    calendar_settings: {
                        ...settings,
                        lastSyncedAt: new Date().toISOString(),
                        lastSyncError: null,
                    },
                },
                {
                    where: { id: user.id },
                }
            );

            return {
                success: true,
                notModified: true,
            };
        }

        const parseResult = await icsParser.parseICS(fetchResult.data, user.id);

        await User.update(
            {
                calendar_settings: {
                    ...settings,
                    lastSyncedAt: new Date().toISOString(),
                    lastSyncError: null,
                    etag: fetchResult.etag,
                    lastModified: fetchResult.lastModified,
                },
            },
            {
                where: { id: user.id },
            }
        );

        return {
            success: true,
            eventsProcessed: parseResult.eventsProcessed || 0,
        };
    } catch (error) {
        const settings =
            typeof user.calendar_settings === 'string'
                ? JSON.parse(user.calendar_settings)
                : user.calendar_settings;

        await User.update(
            {
                calendar_settings: {
                    ...settings,
                    lastSyncedAt: new Date().toISOString(),
                    lastSyncError: error.message,
                },
            },
            {
                where: { id: user.id },
            }
        );

        logError(`Error syncing calendar for user ${user.id}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Main function called by scheduler
 * Finds users due for sync and syncs them with proper locking
 *
 * @returns {Promise<Object>} - Summary of sync results
 */
async function syncDueUsers() {
    try {
        const dueUsers = await findDueUsers();

        if (dueUsers.length === 0) {
            return {
                success: true,
                usersProcessed: 0,
                usersSynced: 0,
                usersSkipped: 0,
                usersErrored: 0,
            };
        }

        logInfo(`Calendar sync: Found ${dueUsers.length} users due for sync`);

        let usersSynced = 0;
        let usersSkipped = 0;
        let usersErrored = 0;

        // Process each user sequentially to avoid overwhelming the system
        for (const user of dueUsers) {
            try {
                // Try to acquire lock
                const lockAcquired = await lockUserSync(user.id);

                if (!lockAcquired) {
                    logInfo(
                        `Calendar sync: User ${user.id} (${user.email}) is already being synced, skipping`
                    );
                    usersSkipped++;
                    continue;
                }

                logInfo(
                    `Calendar sync: Syncing user ${user.id} (${user.email})`
                );

                // Perform sync
                const result = await syncUserCalendar(user);

                if (result.success) {
                    usersSynced++;
                    if (result.notModified) {
                        logInfo(
                            `Calendar sync: User ${user.id} (${user.email}) - no changes`
                        );
                    } else {
                        logInfo(
                            `Calendar sync: User ${user.id} (${user.email}) - ${result.eventsProcessed || 0} events processed`
                        );
                    }
                } else {
                    usersErrored++;
                    logError(
                        `Calendar sync: User ${user.id} (${user.email}) - error: ${result.error}`
                    );
                }

                // Release lock
                await unlockUserSync(user.id);
            } catch (error) {
                usersErrored++;
                logError(`Error processing user ${user.id}:`, error);
                // Try to release lock even if error occurred
                await unlockUserSync(user.id);
            }
        }

        const summary = {
            success: true,
            usersProcessed: dueUsers.length,
            usersSynced,
            usersSkipped,
            usersErrored,
        };

        logInfo(
            `Calendar sync completed: ${usersSynced} synced, ${usersSkipped} skipped, ${usersErrored} errored`
        );

        return summary;
    } catch (error) {
        logError('Error in calendar sync scheduler:', error);
        throw error;
    }
}

module.exports = {
    syncUserIcs,
    syncDueUsers,
    lockUserSync,
    unlockUserSync,
    findDueUsers,
    isUserDueForSync,
    // Export for testing
    _SYNC_PRESETS: SYNC_PRESETS,
    _LOCK_TIMEOUT_MS: LOCK_TIMEOUT_MS,
};
