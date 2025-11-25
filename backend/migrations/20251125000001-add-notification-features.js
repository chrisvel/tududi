'use strict';

const {
    safeAddColumns,
    safeAddIndex,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add notification_preferences to users table
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'notification_preferences',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: {
                        dueTasks: { inApp: true, email: false, push: false },
                        overdueTasks: {
                            inApp: true,
                            email: false,
                            push: false,
                        },
                        dueProjects: { inApp: true, email: false, push: false },
                        overdueProjects: {
                            inApp: true,
                            email: false,
                            push: false,
                        },
                        deferUntil: { inApp: true, email: false, push: false },
                    },
                    comment:
                        'User notification channel preferences for different notification types',
                },
            },
        ]);

        // Add dismissed_at to notifications table
        await safeAddColumns(queryInterface, 'notifications', [
            {
                name: 'dismissed_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);

        // Add indexes for better query performance
        await safeAddIndex(queryInterface, 'notifications', ['dismissed_at'], {
            name: 'notifications_dismissed_at_idx',
        });

        await safeAddIndex(
            queryInterface,
            'notifications',
            ['user_id', 'dismissed_at'],
            {
                name: 'notifications_user_dismissed_idx',
            }
        );
    },

    async down(queryInterface, Sequelize) {
        // Remove indexes first
        try {
            await queryInterface.removeIndex(
                'notifications',
                'notifications_user_dismissed_idx'
            );
        } catch (error) {
            console.log('Index notifications_user_dismissed_idx not found');
        }

        try {
            await queryInterface.removeIndex(
                'notifications',
                'notifications_dismissed_at_idx'
            );
        } catch (error) {
            console.log('Index notifications_dismissed_at_idx not found');
        }

        // Remove columns
        await safeRemoveColumn(queryInterface, 'notifications', 'dismissed_at');
        await safeRemoveColumn(
            queryInterface,
            'users',
            'notification_preferences'
        );
    },
};
