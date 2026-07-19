'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'ai_daily_brief',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                name: 'ai_daily_brief_date',
                definition: {
                    type: Sequelize.DATEONLY,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'ai_daily_brief');
        await queryInterface.removeColumn('users', 'ai_daily_brief_date');
    },
};
