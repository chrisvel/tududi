'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('calendar_events', {
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
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            source: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Source of the event (e.g., "ics")',
            },
            ical_uid: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'VEVENT UID from ICS file',
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            starts_at: {
                type: Sequelize.DATE,
                allowNull: false,
                comment: 'Event start date/time',
            },
            ends_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Event end date/time',
            },
            all_day: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'True for all-day events',
            },
            location: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Event location',
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Event description',
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

        // Unique constraint: prevent duplicate events for same user/source/uid/start time
        await queryInterface.addConstraint('calendar_events', {
            fields: ['user_id', 'source', 'ical_uid', 'starts_at'],
            type: 'unique',
            name: 'calendar_events_unique_event',
        });

        // Index for efficient queries by user and start date
        await queryInterface.addIndex('calendar_events', {
            fields: ['user_id', 'starts_at'],
            name: 'calendar_events_user_starts_at_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('calendar_events');
    },
};
