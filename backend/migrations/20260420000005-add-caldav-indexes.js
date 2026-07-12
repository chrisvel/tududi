'use strict';

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
    try {
        const indexes = await queryInterface.showIndex(tableName);
        const exists = indexes.some((idx) => idx.name === options.name);
        if (!exists) {
            await queryInterface.addIndex(tableName, fields, options);
        }
    } catch (err) {
        console.log(`Skipping index ${options.name}: ${err.message}`);
    }
}

module.exports = {
    up: async (queryInterface) => {
        await addIndexIfMissing(
            queryInterface,
            'caldav_calendars',
            ['user_id'],
            {
                name: 'idx_caldav_calendars_user_id',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_calendars',
            ['enabled'],
            {
                name: 'idx_caldav_calendars_enabled',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_calendars',
            ['user_id', 'enabled'],
            {
                name: 'idx_caldav_calendars_user_enabled',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_sync_state',
            ['task_id'],
            {
                name: 'idx_caldav_sync_state_task_id',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_sync_state',
            ['calendar_id'],
            {
                name: 'idx_caldav_sync_state_calendar_id',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_sync_state',
            ['sync_status'],
            {
                name: 'idx_caldav_sync_state_status',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_sync_state',
            ['last_modified'],
            {
                name: 'idx_caldav_sync_state_modified',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_occurrence_overrides',
            ['parent_task_id'],
            {
                name: 'idx_caldav_overrides_parent',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_occurrence_overrides',
            ['calendar_id'],
            {
                name: 'idx_caldav_overrides_calendar',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_occurrence_overrides',
            ['recurrence_id'],
            {
                name: 'idx_caldav_overrides_recurrence',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_remote_calendars',
            ['user_id'],
            {
                name: 'idx_caldav_remote_user_id',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_remote_calendars',
            ['enabled'],
            {
                name: 'idx_caldav_remote_enabled',
            }
        );
        await addIndexIfMissing(
            queryInterface,
            'caldav_remote_calendars',
            ['local_calendar_id'],
            {
                name: 'idx_caldav_remote_local_cal',
            }
        );
        await addIndexIfMissing(queryInterface, 'tasks', ['uid'], {
            name: 'idx_tasks_uid',
            unique: false,
        });
        await addIndexIfMissing(queryInterface, 'tasks', ['updated_at'], {
            name: 'idx_tasks_updated_at',
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeIndex(
            'caldav_calendars',
            'idx_caldav_calendars_user_id'
        );
        await queryInterface.removeIndex(
            'caldav_calendars',
            'idx_caldav_calendars_enabled'
        );
        await queryInterface.removeIndex(
            'caldav_calendars',
            'idx_caldav_calendars_user_enabled'
        );
        await queryInterface.removeIndex(
            'caldav_sync_state',
            'idx_caldav_sync_state_task_id'
        );
        await queryInterface.removeIndex(
            'caldav_sync_state',
            'idx_caldav_sync_state_calendar_id'
        );
        await queryInterface.removeIndex(
            'caldav_sync_state',
            'idx_caldav_sync_state_status'
        );
        await queryInterface.removeIndex(
            'caldav_sync_state',
            'idx_caldav_sync_state_modified'
        );
        await queryInterface.removeIndex(
            'caldav_occurrence_overrides',
            'idx_caldav_overrides_parent'
        );
        await queryInterface.removeIndex(
            'caldav_occurrence_overrides',
            'idx_caldav_overrides_calendar'
        );
        await queryInterface.removeIndex(
            'caldav_occurrence_overrides',
            'idx_caldav_overrides_recurrence'
        );
        await queryInterface.removeIndex(
            'caldav_remote_calendars',
            'idx_caldav_remote_user_id'
        );
        await queryInterface.removeIndex(
            'caldav_remote_calendars',
            'idx_caldav_remote_enabled'
        );
        await queryInterface.removeIndex(
            'caldav_remote_calendars',
            'idx_caldav_remote_local_cal'
        );
        await queryInterface.removeIndex('tasks', 'idx_tasks_uid');
        await queryInterface.removeIndex('tasks', 'idx_tasks_updated_at');
    },
};
