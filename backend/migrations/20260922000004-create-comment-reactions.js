'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// One reaction per user per comment: liking then disliking updates the
// same row rather than adding a second one. Purely additive: no existing
// table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'comment_reactions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            comment_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'comments', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            reaction_type: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await addIndexOnce(
            queryInterface,
            'comment_reactions',
            ['comment_id', 'user_id'],
            { unique: true, name: 'comment_reactions_comment_id_user_id' }
        );
        await addIndexOnce(
            queryInterface,
            'comment_reactions',
            ['comment_id'],
            { name: 'comment_reactions_comment_id' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('comment_reactions');
    },
};
