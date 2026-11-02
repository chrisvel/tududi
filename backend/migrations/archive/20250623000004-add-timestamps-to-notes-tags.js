'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'notes_tags', [
            {
                name: 'created_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            },
            {
                name: 'updated_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            },
        ]);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('notes_tags', 'created_at');
        await queryInterface.removeColumn('notes_tags', 'updated_at');
    },
};
