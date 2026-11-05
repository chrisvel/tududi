'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'usage_counters', {
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
            metric: { type: Sequelize.STRING(32), allowNull: false },
            period_key: { type: Sequelize.STRING(16), allowNull: false },
            count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        });

        // Composite unique index: safeAddIndex skips composites when any
        // column already has an index, so it is added directly.
        const indexes = await queryInterface.showIndex('usage_counters');
        if (
            !indexes.some((i) => i.name === 'usage_counters_user_metric_period')
        ) {
            await queryInterface.addIndex(
                'usage_counters',
                ['user_id', 'metric', 'period_key'],
                { unique: true, name: 'usage_counters_user_metric_period' }
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable('usage_counters');
    },
};
