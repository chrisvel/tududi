'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

// A deleted comment is a tombstone: the row stays (so the thread keeps its
// order and a "Comment deleted" placeholder can render in its place), but
// its body and mentions are cleared. Nullable and additive: every existing
// comment stays visible as-is.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'comments', [
            {
                name: 'deleted_at',
                definition: { type: Sequelize.DATE, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('comments', 'deleted_at');
    },
};
