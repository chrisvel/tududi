'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tags', [
            {
                name: 'pinned',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tags', 'pinned');
    },
};
