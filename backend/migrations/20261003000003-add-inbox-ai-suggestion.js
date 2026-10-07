'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // The last AI assist result for an inbox item, kept so it shows again
    // when the inbox is reopened, and a fingerprint of the item's text and
    // files it was made from, so a changed item is asked about again.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'inbox_items', [
            {
                name: 'ai_suggestion',
                definition: { type: Sequelize.JSON, allowNull: true },
            },
            {
                name: 'ai_suggestion_key',
                definition: { type: Sequelize.STRING(64), allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(
            queryInterface,
            'inbox_items',
            'ai_suggestion_key'
        );
        await safeRemoveColumn(queryInterface, 'inbox_items', 'ai_suggestion');
    },
};
