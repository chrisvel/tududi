const { AppError } = require('../../../shared/errors/AppError');
const syncScheduler = require('../services/sync-scheduler');
const syncEngine = require('../sync/sync-engine');
const MergePhase = require('../sync/merge-phase');
const CalendarRepository = require('../repositories/calendar-repository');
const SyncStateRepository = require('../repositories/sync-state-repository');

class SyncController {
    async syncCalendar(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;
        const { direction = 'bidirectional', dryRun = false } = req.body;

        const calendar = await CalendarRepository.findById(id);

        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        const result = await syncEngine.syncCalendar(calendar.id, userId, {
            direction,
            dryRun,
        });

        res.json(result);
    }

    async syncAllCalendars(req, res) {
        const userId = req.currentUser.id;
        const { force = false, dryRun = false } = req.body;

        const result = await syncScheduler.syncUserCalendars(userId, {
            force,
            dryRun,
        });

        res.json(result);
    }

    async getSyncStatus(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;

        const calendar = await CalendarRepository.findById(id);

        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        const status = await syncEngine.getSyncStatus(calendar.id, userId);

        res.json(status);
    }

    async listConflicts(req, res) {
        const userId = req.currentUser.id;
        const { calendarId } = req.query;

        let conflicts;
        if (calendarId) {
            const calendar = await CalendarRepository.findById(calendarId);

            if (!calendar) {
                throw new AppError('Calendar not found', 404);
            }

            if (calendar.user_id !== userId) {
                throw new AppError('Unauthorized access to calendar', 403);
            }

            conflicts = await SyncStateRepository.findConflicts(calendarId);
        } else {
            conflicts = await SyncStateRepository.findConflictsByUser(userId);
        }

        res.json(conflicts);
    }

    async getConflict(req, res) {
        const { taskId } = req.params;
        const userId = req.currentUser.id;
        const { calendarId } = req.query;

        if (!calendarId) {
            throw new AppError('calendarId query parameter is required', 400);
        }

        const calendar = await CalendarRepository.findById(calendarId);

        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        const conflict = await SyncStateRepository.findByTaskAndCalendar(
            taskId,
            calendarId
        );

        if (!conflict || conflict.sync_status !== 'conflict') {
            throw new AppError('No conflict found for this task', 404);
        }

        res.json(conflict);
    }

    async resolveConflict(req, res) {
        const { taskId } = req.params;
        const userId = req.currentUser.id;
        const { calendarId, resolution } = req.body;

        if (!calendarId) {
            throw new AppError('calendarId is required', 400);
        }

        if (!resolution) {
            throw new AppError('resolution is required', 400);
        }

        const validResolutions = ['local', 'remote'];
        if (!validResolutions.includes(resolution)) {
            throw new AppError(
                `Invalid resolution. Must be one of: ${validResolutions.join(', ')}`,
                400
            );
        }

        const calendar = await CalendarRepository.findById(calendarId);

        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        const mergePhase = new MergePhase();
        const resolvedTask = await mergePhase.resolveConflict(
            taskId,
            calendarId,
            resolution
        );

        res.json({
            success: true,
            task: resolvedTask,
            resolution,
        });
    }

    async getSchedulerStatus(req, res) {
        const status = syncScheduler.getStatus();

        res.json(status);
    }
}

module.exports = new SyncController();
