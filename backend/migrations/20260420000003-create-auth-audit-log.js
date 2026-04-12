'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'auth_audit_log', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            event_type: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            auth_method: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            provider_slug: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            ip_address: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            user_agent: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            metadata: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'auth_audit_log', ['user_id']);
        await safeAddIndex(queryInterface, 'auth_audit_log', ['event_type']);
        await safeAddIndex(queryInterface, 'auth_audit_log', ['created_at']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('auth_audit_log', ['created_at']);
        await queryInterface.removeIndex('auth_audit_log', ['event_type']);
        await queryInterface.removeIndex('auth_audit_log', ['user_id']);

        await queryInterface.dropTable('auth_audit_log');
    },
};
