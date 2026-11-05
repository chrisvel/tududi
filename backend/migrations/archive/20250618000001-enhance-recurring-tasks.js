'use strict';

const {
    safeAddColumns,
    safeAddIndex,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'recurrence_weekday',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    comment:
                        'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) for weekly recurrence',
                },
            },
            {
                name: 'recurrence_month_day',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    comment: 'Day of month (1-31) for monthly recurrence',
                },
            },
            {
                name: 'recurrence_week_of_month',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    comment:
                        'Week of month (1-4, -1=last) for monthly recurrence',
                },
            },
            {
                name: 'completion_based',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                    comment:
                        'Whether recurrence is based on completion date (true) or due date (false)',
                },
            },
        ]);

        await safeAddIndex(
            queryInterface,
            'tasks',
            ['recurrence_type', 'last_generated_date'],
            {
                name: 'idx_tasks_recurrence_lookup',
            }
        );
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'tasks', 'recurrence_weekday');
        await safeRemoveColumn(queryInterface, 'tasks', 'recurrence_month_day');
        await safeRemoveColumn(
            queryInterface,
            'tasks',
            'recurrence_week_of_month'
        );
        await safeRemoveColumn(queryInterface, 'tasks', 'completion_based');

        try {
            await queryInterface.removeIndex(
                'tasks',
                'idx_tasks_recurrence_lookup'
            );
        } catch (error) {
            console.log(
                'Could not remove index idx_tasks_recurrence_lookup:',
                error.message
            );
        }
    },
};
