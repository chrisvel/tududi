'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'image_url',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('projects', 'image_url');
    },
};
