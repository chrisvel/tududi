'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'people', [
            {
                name: 'color',
                definition: {
                    type: Sequelize.STRING(20),
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('people', 'color');
    },
};
