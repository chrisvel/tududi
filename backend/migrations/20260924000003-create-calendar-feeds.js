'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

module.exports = {
    // Read-only iCal feeds (for example Google Calendar's secret address)
    // shown next to the day plan. The URL is a secret, stored encrypted.
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'calendar_feeds', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            url_encrypted: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            url_host: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            color: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            last_fetched_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_error: {
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

        await addIndexOnce(queryInterface, 'calendar_feeds', ['user_id'], {
            name: 'calendar_feeds_user_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('calendar_feeds');
    },
};
