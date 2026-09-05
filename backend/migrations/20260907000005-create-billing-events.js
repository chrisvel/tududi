'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'billing_events', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            stripe_event_id: {
                type: Sequelize.STRING(64),
                allowNull: false,
                unique: true,
            },
            type: { type: Sequelize.STRING(64), allowNull: false },
            status: {
                type: Sequelize.STRING(16),
                allowNull: false,
                defaultValue: 'received',
            },
            user_id: { type: Sequelize.INTEGER, allowNull: true },
            error: { type: Sequelize.TEXT, allowNull: true },
            processed_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        });

        await safeAddIndex(queryInterface, 'billing_events', ['type'], {
            name: 'billing_events_type',
        });
        await safeAddIndex(queryInterface, 'billing_events', ['created_at'], {
            name: 'billing_events_created_at',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('billing_events');
    },
};
