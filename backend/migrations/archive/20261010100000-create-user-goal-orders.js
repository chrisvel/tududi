'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// Custom order of the Goals page, one row per user and goal. Purely
// additive: no existing table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'user_goal_orders', {
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
            goal_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'goals', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            position: {
                type: Sequelize.INTEGER,
                allowNull: false,
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

        await addIndexOnce(
            queryInterface,
            'user_goal_orders',
            ['user_id', 'goal_id'],
            {
                unique: true,
                name: 'user_goal_orders_user_goal_unique',
            }
        );
        await addIndexOnce(queryInterface, 'user_goal_orders', ['goal_id'], {
            name: 'user_goal_orders_goal_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_goal_orders');
    },
};
