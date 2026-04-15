const { AppError } = require('../../../shared/errors/AppError');
const CalendarRepository = require('../repositories/calendar-repository');
const SyncStateRepository = require('../repositories/sync-state-repository');
const { uid } = require('../../../utils/uid');

class CalendarController {
    async listCalendars(req, res) {
        const userId = req.currentUser.id;

        const calendars = await CalendarRepository.findByUserId(userId);

        const calendarsWithStats = await Promise.all(
            calendars.map(async (calendar) => {
                const stats = await SyncStateRepository.getSyncStats(
                    calendar.id
                );
                return {
                    ...calendar.toJSON(),
                    stats,
                };
            })
        );

        res.json(calendarsWithStats);
    }

    async getCalendar(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;

        const calendar = await CalendarRepository.findById(id);

        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        const stats = await SyncStateRepository.getSyncStats(calendar.id);

        res.json({
            ...calendar.toJSON(),
            stats,
        });
    }

    async createCalendar(req, res) {
        const userId = req.currentUser.id;
        const {
            name,
            description,
            color,
            enabled = true,
            sync_direction = 'bidirectional',
            sync_interval_minutes = 15,
            conflict_resolution = 'last_write_wins',
        } = req.body;

        if (!name) {
            throw new AppError('Calendar name is required', 400);
        }

        const validDirections = ['bidirectional', 'pull', 'push'];
        if (!validDirections.includes(sync_direction)) {
            throw new AppError(
                `Invalid sync direction. Must be one of: ${validDirections.join(', ')}`,
                400
            );
        }

        const validResolutions = [
            'last_write_wins',
            'local_wins',
            'remote_wins',
            'manual',
        ];
        if (!validResolutions.includes(conflict_resolution)) {
            throw new AppError(
                `Invalid conflict resolution. Must be one of: ${validResolutions.join(', ')}`,
                400
            );
        }

        if (
            !Number.isInteger(sync_interval_minutes) ||
            sync_interval_minutes < 1 ||
            sync_interval_minutes > 1440
        ) {
            throw new AppError(
                'Sync interval must be between 1 and 1440 minutes',
                400
            );
        }

        const calendar = await CalendarRepository.create({
            uid: uid(),
            user_id: userId,
            name,
            description: description || null,
            color: color || null,
            enabled,
            sync_direction,
            sync_interval_minutes,
            conflict_resolution,
        });

        res.status(201).json(calendar);
    }

    async updateCalendar(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;

        const calendar = await CalendarRepository.findById(id);

        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        const {
            name,
            description,
            color,
            enabled,
            sync_direction,
            sync_interval_minutes,
            conflict_resolution,
        } = req.body;

        const updates = {};

        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (color !== undefined) updates.color = color;
        if (enabled !== undefined) updates.enabled = enabled;
        if (sync_direction !== undefined) {
            const validDirections = ['bidirectional', 'pull', 'push'];
            if (!validDirections.includes(sync_direction)) {
                throw new AppError(
                    `Invalid sync direction. Must be one of: ${validDirections.join(', ')}`,
                    400
                );
            }
            updates.sync_direction = sync_direction;
        }
        if (sync_interval_minutes !== undefined) {
            if (
                !Number.isInteger(sync_interval_minutes) ||
                sync_interval_minutes < 1 ||
                sync_interval_minutes > 1440
            ) {
                throw new AppError(
                    'Sync interval must be between 1 and 1440 minutes',
                    400
                );
            }
            updates.sync_interval_minutes = sync_interval_minutes;
        }
        if (conflict_resolution !== undefined) {
            const validResolutions = [
                'last_write_wins',
                'local_wins',
                'remote_wins',
                'manual',
            ];
            if (!validResolutions.includes(conflict_resolution)) {
                throw new AppError(
                    `Invalid conflict resolution. Must be one of: ${validResolutions.join(', ')}`,
                    400
                );
            }
            updates.conflict_resolution = conflict_resolution;
        }

        const updatedCalendar = await CalendarRepository.update(
            calendar,
            updates
        );

        res.json(updatedCalendar);
    }

    async deleteCalendar(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;

        const calendar = await CalendarRepository.findById(id);

        if (!calendar) {
            throw new AppError('Calendar not found', 404);
        }

        if (calendar.user_id !== userId) {
            throw new AppError('Unauthorized access to calendar', 403);
        }

        await SyncStateRepository.deleteByCalendarId(calendar.id);

        await CalendarRepository.delete(calendar);

        res.status(204).send();
    }
}

module.exports = new CalendarController();
