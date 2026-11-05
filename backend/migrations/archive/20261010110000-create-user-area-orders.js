'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// Custom order of the Areas page, one row per user and area. Purely
// additive: no existing table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'user_area_orders', {
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
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'areas', key: 'id' },
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
            'user_area_orders',
            ['user_id', 'area_id'],
            {
                unique: true,
                name: 'user_area_orders_user_area_unique',
            }
        );
        await addIndexOnce(queryInterface, 'user_area_orders', ['area_id'], {
            name: 'user_area_orders_area_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_area_orders');
    },
};
