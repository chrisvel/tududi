'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'caldav_sync_state', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            calendar_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'caldav_calendars',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            etag: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            last_modified: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            last_synced_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            sync_status: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'synced',
            },
            conflict_local_version: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            conflict_remote_version: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            conflict_detected_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'caldav_sync_state', ['task_id'], {
            name: 'caldav_sync_state_task_id_idx',
        });

        await safeAddIndex(
            queryInterface,
            'caldav_sync_state',
            ['calendar_id'],
            {
                name: 'caldav_sync_state_calendar_id_idx',
            }
        );

        await safeAddIndex(queryInterface, 'caldav_sync_state', ['etag'], {
            name: 'caldav_sync_state_etag_idx',
        });

        await safeAddIndex(
            queryInterface,
            'caldav_sync_state',
            ['sync_status'],
            {
                name: 'caldav_sync_state_sync_status_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'caldav_sync_state',
            ['task_id', 'calendar_id'],
            {
                name: 'caldav_sync_state_task_calendar_unique',
                unique: true,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('caldav_sync_state');
    },
};
