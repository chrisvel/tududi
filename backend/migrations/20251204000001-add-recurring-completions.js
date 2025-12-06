'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'recurring_completions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            completed_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            original_due_date: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            skipped: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'recurring_completions', [
            'task_id',
        ]);
        await safeAddIndex(queryInterface, 'recurring_completions', [
            'completed_at',
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('recurring_completions');
    },
};
