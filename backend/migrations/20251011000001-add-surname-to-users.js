'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('users', 'surname', {
            type: Sequelize.STRING,
            allowNull: true,
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('users', 'surname');
    },
};
