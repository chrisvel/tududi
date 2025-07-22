'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        try {
            const tableInfo = await queryInterface.describeTable('projects');

            // Check if task_show_completed column already exists
            if (!('task_show_completed' in tableInfo)) {
                await queryInterface.addColumn(
                    'projects',
                    'task_show_completed',
                    {
                        type: Sequelize.BOOLEAN,
                        allowNull: true,
                        defaultValue: false,
                    }
                );
            }

            // Check if task_sort_order column already exists
            if (!('task_sort_order' in tableInfo)) {
                await queryInterface.addColumn('projects', 'task_sort_order', {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: 'created_at:desc',
                });
            }
        } catch (error) {
            console.log('Migration error:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('projects', 'task_show_completed');
        await queryInterface.removeColumn('projects', 'task_sort_order');
    },
};
