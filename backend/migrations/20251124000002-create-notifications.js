'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'notifications', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                unique: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            type: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Type of notification (task_assigned, reminder, etc.)',
            },
            level: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'info',
                comment: 'Notification level: info, warning, error, success',
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            data: {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'Additional structured data for the notification',
            },
            sources: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: '[]',
                comment: 'Array of source platforms: telegram, mobile, browser',
            },
            read_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            sent_at: {
                type: Sequelize.DATE,
                allowNull: true,
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

        // Add indexes for efficient querying
        await safeAddIndex(queryInterface, 'notifications', ['user_id']);
        await safeAddIndex(queryInterface, 'notifications', ['read_at']);
        await safeAddIndex(queryInterface, 'notifications', ['created_at']);
        await safeAddIndex(queryInterface, 'notifications', [
            'user_id',
            'read_at',
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('notifications');
    },
};
