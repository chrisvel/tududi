'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'inbox_items', [
            {
                name: 'title',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment:
                        'Optional title field for inbox items, auto-generated for long content',
                },
            },
        ]);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('inbox_items', 'title');
    },
};
