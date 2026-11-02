'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'start_date',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                name: 'start_has_time',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'start_date_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                name: 'start_has_time',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('projects', 'start_has_time');
        await queryInterface.removeColumn('projects', 'start_date_at');
        await queryInterface.removeColumn('tasks', 'start_has_time');
        await queryInterface.removeColumn('tasks', 'start_date');
    },
};
