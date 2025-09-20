'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'state',
                definition: {
                    type: Sequelize.ENUM(
                        'idea',
                        'planned',
                        'in_progress',
                        'blocked',
                        'completed'
                    ),
                    allowNull: false,
                    defaultValue: 'idea',
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('projects', 'state');
    },
};
