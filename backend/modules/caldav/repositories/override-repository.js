const BaseRepository = require('../../../shared/database/BaseRepository');
const { CalDAVOccurrenceOverride } = require('../../../models');

class OverrideRepository extends BaseRepository {
    constructor() {
        super(CalDAVOccurrenceOverride);
    }

    async findByParentTaskId(parentTaskId, options = {}) {
        return this.findAll({ parent_task_id: parentTaskId }, options);
    }

    async findByCalendarId(calendarId, options = {}) {
        return this.findAll({ calendar_id: calendarId }, options);
    }

    async findByRecurrenceId(
        parentTaskId,
        calendarId,
        recurrenceId,
        options = {}
    ) {
        return this.findOne(
            {
                parent_task_id: parentTaskId,
                calendar_id: calendarId,
                recurrence_id: recurrenceId,
            },
            options
        );
    }

    async createOrUpdate(
        parentTaskId,
        calendarId,
        recurrenceId,
        overrides,
        options = {}
    ) {
        const existing = await this.findByRecurrenceId(
            parentTaskId,
            calendarId,
            recurrenceId
        );

        if (existing) {
            return this.update(existing, overrides, options);
        }

        return this.create(
            {
                parent_task_id: parentTaskId,
                calendar_id: calendarId,
                recurrence_id: recurrenceId,
                ...overrides,
            },
            options
        );
    }

    async deleteByRecurrenceId(
        parentTaskId,
        calendarId,
        recurrenceId,
        options = {}
    ) {
        const override = await this.findByRecurrenceId(
            parentTaskId,
            calendarId,
            recurrenceId
        );

        if (override) {
            return this.destroy(override, options);
        }

        return null;
    }

    async deleteAllForTask(parentTaskId, calendarId, options = {}) {
        const overrides = await this.findAll(
            { parent_task_id: parentTaskId, calendar_id: calendarId },
            options
        );

        return Promise.all(
            overrides.map((override) => this.destroy(override, options))
        );
    }
}

module.exports = new OverrideRepository();
