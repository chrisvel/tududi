'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        try {
            // Get current table schema
            const tableInfo = await queryInterface.describeTable('tasks');

            // Define columns to add
            const columnsToAdd = [
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
                        comment:
                            'Day of month (1-31) for monthly recurrence, -1 for last day',
                    },
                },
                {
                    name: 'recurrence_week_of_month',
                    definition: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        comment:
                            'Week of month (1-5) for monthly weekday recurrence',
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
            ];

            // Add only missing columns
            for (const column of columnsToAdd) {
                if (!(column.name in tableInfo)) {
                    await queryInterface.addColumn(
                        'tasks',
                        column.name,
                        column.definition
                    );
                }
            }

            // Add index if it doesn't exist
            try {
                const indexes = await queryInterface.showIndex('tasks');
                const indexExists = indexes.some(
                    (index) => index.name === 'idx_tasks_recurrence_lookup'
                );

                if (!indexExists) {
                    await queryInterface.addIndex(
                        'tasks',
                        ['recurrence_type', 'last_generated_date'],
                        {
                            name: 'idx_tasks_recurrence_lookup',
                        }
                    );
                }
            } catch (indexError) {
                console.log(
                    'Could not check or add index:',
                    indexError.message
                );
            }
        } catch (error) {
            console.log('Migration error:', error.message);
            throw error;
        }
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
