'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tags', [
            {
                name: 'color',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tags', 'color');
    },
};
