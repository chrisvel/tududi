'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

const INDEX_NAME = 'notes_public_token_unique';

// A note is public while it holds a token: the public link is built from it,
// and clearing it kills the link. Nullable, so every existing note stays
// private and no data is rewritten. The unique index is added apart from the
// column because SQLite cannot add a UNIQUE column to an existing table.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'notes', [
            {
                name: 'public_token',
                definition: { type: Sequelize.STRING(64), allowNull: true },
            },
            {
                name: 'public_shared_at',
                definition: { type: Sequelize.DATE, allowNull: true },
            },
        ]);

        const indexes = await queryInterface.showIndex('notes');
        if (!indexes.some((i) => i.name === INDEX_NAME)) {
            await queryInterface.addIndex('notes', ['public_token'], {
                name: INDEX_NAME,
                unique: true,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('notes', INDEX_NAME);
        await queryInterface.removeColumn('notes', 'public_shared_at');
        await queryInterface.removeColumn('notes', 'public_token');
    },
};
