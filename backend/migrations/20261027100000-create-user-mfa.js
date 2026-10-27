'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// Two-factor sign-in: one authenticator secret per user and their single-use
// recovery codes. Purely additive: no existing table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'user_mfa', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            secret_encrypted: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            last_used_step: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            enabled_at: {
                type: Sequelize.DATE,
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

        await safeCreateTable(queryInterface, 'user_recovery_codes', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            code_hash: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            used_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await addIndexOnce(queryInterface, 'user_recovery_codes', ['user_id'], {
            name: 'user_recovery_codes_user',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_recovery_codes');
        await queryInterface.dropTable('user_mfa');
    },
};
