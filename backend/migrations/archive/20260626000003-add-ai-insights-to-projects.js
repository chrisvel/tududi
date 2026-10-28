'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'ai_insights',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('projects', 'ai_insights');
    },
};
