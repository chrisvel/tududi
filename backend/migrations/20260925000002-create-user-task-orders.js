'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// Manual order of tasks, one row per user, list (scope) and task. Purely
// additive: no existing table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'user_task_orders', {
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
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            scope: {
                type: Sequelize.STRING(64),
                allowNull: false,
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
            'user_task_orders',
            ['user_id', 'scope', 'task_id'],
            { unique: true, name: 'user_task_orders_user_scope_task_unique' }
        );
        await addIndexOnce(queryInterface, 'user_task_orders', ['task_id'], {
            name: 'user_task_orders_task_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_task_orders');
    },
};
