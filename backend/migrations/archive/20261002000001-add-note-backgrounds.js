'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // A note's photo background, and whether its public page shows the note's
    // color and background.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'notes', [
            {
                name: 'background',
                definition: { type: Sequelize.STRING(40), allowNull: true },
            },
            {
                name: 'public_inherit_style',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'notes', 'public_inherit_style');
        await safeRemoveColumn(queryInterface, 'notes', 'background');
    },
};
