'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

// safeAddIndex skips an index when any of its columns is already indexed, so
// every index here is added directly and guarded by name.
async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

module.exports = {
    // Sign-in links for members without an email. Only the hash of the token is
    // kept, so reading the table does not give anyone a usable link. Purely
    // additive: no existing table is touched.
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'member_sign_in_links', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            token_hash: {
                type: Sequelize.STRING(64),
                allowNull: false,
                unique: true,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            used_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_by_user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
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
        // Unique: a member has at most one link, so two simultaneous requests
        // cannot both leave a live one behind.
        await addIndexOnce(
            queryInterface,
            'member_sign_in_links',
            ['user_id'],
            {
                unique: true,
                name: 'member_sign_in_links_user_id',
            }
        );
        await addIndexOnce(
            queryInterface,
            'member_sign_in_links',
            ['created_by_user_id'],
            { name: 'member_sign_in_links_created_by_user_id' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('member_sign_in_links');
    },
};
