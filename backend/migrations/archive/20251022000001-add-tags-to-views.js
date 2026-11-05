'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'views', [
            {
                name: 'tags',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment: 'JSON array of tag names for filtering',
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('views', 'tags');
    },
};
