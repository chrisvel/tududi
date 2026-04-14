'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'caldav_remote_calendars', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            local_calendar_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'caldav_calendars',
                    key: 'id',
                },
                onDelete: 'SET NULL',
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            server_url: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            calendar_path: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            password_encrypted: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            auth_type: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'basic',
            },
            enabled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            sync_direction: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'bidirectional',
            },
            last_sync_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_sync_status: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            last_sync_error: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            server_ctag: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            server_sync_token: {
                type: Sequelize.STRING,
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
            'caldav_remote_calendars',
            ['user_id'],
            {
                name: 'caldav_remote_calendars_user_id_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'caldav_remote_calendars',
            ['local_calendar_id'],
            {
                name: 'caldav_remote_calendars_local_calendar_id_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'caldav_remote_calendars',
            ['enabled'],
            {
                name: 'caldav_remote_calendars_enabled_idx',
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('caldav_remote_calendars');
    },
};
