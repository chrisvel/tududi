'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add productivity assistant enabled column
        await queryInterface.addColumn(
            'users',
            'productivity_assistant_enabled',
            {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            }
        );

        // Add next task suggestion enabled column
        await queryInterface.addColumn(
            'users',
            'next_task_suggestion_enabled',
            {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            }
        );
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
