'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// One row per account email tududi sent or tried to send, so an admin can see
// what each user got. Purely additive: no existing table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'email_deliveries', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            email: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            variant: {
                type: Sequelize.STRING(32),
                allowNull: true,
            },
            recipient: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            subject: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            language: {
                type: Sequelize.STRING(8),
                allowNull: false,
            },
            status: {
                type: Sequelize.STRING(16),
                allowNull: false,
            },
            error: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            triggered_by_user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await addIndexOnce(
            queryInterface,
            'email_deliveries',
            ['user_id', 'created_at'],
            { name: 'email_deliveries_user_created' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('email_deliveries');
    },
};
