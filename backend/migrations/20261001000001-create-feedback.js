'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'feedback', {
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
            message: { type: Sequelize.TEXT, allowNull: false },
            page_url: { type: Sequelize.STRING(512), allowNull: true },
            user_agent: { type: Sequelize.STRING(512), allowNull: true },
            app_version: { type: Sequelize.STRING(32), allowNull: true },
            resolved_at: { type: Sequelize.DATE, allowNull: true },
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
        await safeAddIndex(queryInterface, 'feedback', ['user_id']);
        await safeAddIndex(queryInterface, 'feedback', ['created_at']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('feedback');
    },
};
