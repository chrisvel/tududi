'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// Replies are comments whose parent_comment_id points at another comment
// row - always a top-level one, one level of nesting only (enforced in the
// service, not the schema). Nullable and additive: every existing comment
// stays top-level as-is.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'comments', [
            {
                name: 'parent_comment_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'comments', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
            },
        ]);

        await addIndexOnce(queryInterface, 'comments', ['parent_comment_id'], {
            name: 'comments_parent_comment_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'comments',
            'comments_parent_comment_id'
        );
        await queryInterface.removeColumn('comments', 'parent_comment_id');
    },
};
