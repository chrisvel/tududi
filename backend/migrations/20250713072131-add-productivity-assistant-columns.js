'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        try {
            // Get current table schema
            const tableInfo = await queryInterface.describeTable('users');

            // Define columns to add
            const columnsToAdd = [
                {
                    name: 'productivity_assistant_enabled',
                    definition: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: true,
                    },
                },
                {
                    name: 'next_task_suggestion_enabled',
                    definition: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: true,
                    },
                },
            ];

            // Add only missing columns
            for (const column of columnsToAdd) {
                if (!(column.name in tableInfo)) {
                    await queryInterface.addColumn(
                        'users',
                        column.name,
                        column.definition
                    );
                }
            }
        } catch (error) {
            console.log('Migration error:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        // Remove the added columns
        await queryInterface.removeColumn(
            'users',
            'productivity_assistant_enabled'
        );
        await queryInterface.removeColumn(
            'users',
            'next_task_suggestion_enabled'
        );
    },
};
