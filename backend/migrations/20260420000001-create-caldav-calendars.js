'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'caldav_calendars', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
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
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            color: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            ctag: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            sync_token: {
                type: Sequelize.STRING,
                allowNull: true,
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
            sync_interval_minutes: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 15,
            },
            last_sync_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_sync_status: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            conflict_resolution: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'last_write_wins',
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

        await safeAddIndex(queryInterface, 'caldav_calendars', ['user_id'], {
            name: 'caldav_calendars_user_id_idx',
        });

        await safeAddIndex(queryInterface, 'caldav_calendars', ['uid'], {
            name: 'caldav_calendars_uid_idx',
            unique: true,
        });

        await safeAddIndex(queryInterface, 'caldav_calendars', ['enabled'], {
            name: 'caldav_calendars_enabled_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('caldav_calendars');
    },
};
