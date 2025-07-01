'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'users',
            'auto_suggest_next_actions_enabled',
            {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            }
        );
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn(
            'users',
            'auto_suggest_next_actions_enabled'
        );
    },
};
