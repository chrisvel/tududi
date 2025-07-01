'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add new fields to support enhanced recurring task functionality
        await queryInterface.addColumn('tasks', 'recurrence_weekday', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment:
                'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) for weekly recurrence',
        });

        await queryInterface.addColumn('tasks', 'recurrence_month_day', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment:
                'Day of month (1-31) for monthly recurrence, -1 for last day',
        });

        await queryInterface.addColumn('tasks', 'recurrence_week_of_month', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Week of month (1-5) for monthly weekday recurrence',
        });

        await queryInterface.addColumn('tasks', 'completion_based', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment:
                'Whether recurrence is based on completion date (true) or due date (false)',
        });

        // Add index for efficient recurring task queries
        await queryInterface.addIndex(
            'tasks',
            ['recurrence_type', 'last_generated_date'],
            {
                name: 'idx_tasks_recurrence_lookup',
            }
        );
    },

    async down(queryInterface, Sequelize) {
        // Remove the added columns
        await queryInterface.removeColumn('tasks', 'recurrence_weekday');
        await queryInterface.removeColumn('tasks', 'recurrence_month_day');
        await queryInterface.removeColumn('tasks', 'recurrence_week_of_month');
        await queryInterface.removeColumn('tasks', 'completion_based');

        // Remove the index
        await queryInterface.removeIndex(
            'tasks',
            'idx_tasks_recurrence_lookup'
        );
    },
};
