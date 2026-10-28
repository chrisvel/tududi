'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'caldav_occurrence_overrides', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            parent_task_id: {
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
            recurrence_id: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            override_name: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            override_due_date: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            override_status: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            override_priority: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            override_note: {
                type: Sequelize.TEXT,
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

        await safeAddIndex(
            queryInterface,
            'caldav_occurrence_overrides',
            ['parent_task_id'],
            {
                name: 'caldav_occurrence_overrides_parent_task_id_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'caldav_occurrence_overrides',
            ['calendar_id'],
            {
                name: 'caldav_occurrence_overrides_calendar_id_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'caldav_occurrence_overrides',
            ['recurrence_id'],
            {
                name: 'caldav_occurrence_overrides_recurrence_id_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'caldav_occurrence_overrides',
            ['parent_task_id', 'calendar_id', 'recurrence_id'],
            {
                name: 'caldav_occurrence_overrides_unique',
                unique: true,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('caldav_occurrence_overrides');
    },
};
