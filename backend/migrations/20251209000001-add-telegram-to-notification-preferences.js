'use strict';

const { safeChangeColumn } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Get all users with notification_preferences
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        // Update each user's notification_preferences to include telegram: false
        for (const user of users) {
            const prefs = user.notification_preferences;

            // Add telegram: false to each notification type
            if (prefs.dueTasks) {
                prefs.dueTasks.telegram = false;
            }
            if (prefs.overdueTasks) {
                prefs.overdueTasks.telegram = false;
            }
            if (prefs.dueProjects) {
                prefs.dueProjects.telegram = false;
            }
            if (prefs.overdueProjects) {
                prefs.overdueProjects.telegram = false;
            }
            if (prefs.deferUntil) {
                prefs.deferUntil.telegram = false;
            }

            // Update the user's preferences
            await queryInterface.sequelize.query(
                'UPDATE users SET notification_preferences = :prefs WHERE id = :id',
                {
                    replacements: {
                        prefs: JSON.stringify(prefs),
                        id: user.id,
                    },
                }
            );
        }

        // Update the column default for new users
        await safeChangeColumn(
            queryInterface,
            'users',
            'notification_preferences',
            {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: {
                    dueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    dueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    deferUntil: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                },
                comment:
                    'User notification channel preferences for different notification types',
            }
        );
    },

    async down(queryInterface, Sequelize) {
        // Get all users with notification_preferences
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        // Remove telegram field from each user's notification_preferences
        for (const user of users) {
            const prefs = user.notification_preferences;

            // Remove telegram from each notification type
            if (prefs.dueTasks) {
                delete prefs.dueTasks.telegram;
            }
            if (prefs.overdueTasks) {
                delete prefs.overdueTasks.telegram;
            }
            if (prefs.dueProjects) {
                delete prefs.dueProjects.telegram;
            }
            if (prefs.overdueProjects) {
                delete prefs.overdueProjects.telegram;
            }
            if (prefs.deferUntil) {
                delete prefs.deferUntil.telegram;
            }

            // Update the user's preferences
            await queryInterface.sequelize.query(
                'UPDATE users SET notification_preferences = :prefs WHERE id = :id',
                {
                    replacements: {
                        prefs: JSON.stringify(prefs),
                        id: user.id,
                    },
                }
            );
        }

        // Restore the column default to original (without telegram)
        await safeChangeColumn(
            queryInterface,
            'users',
            'notification_preferences',
            {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: {
                    dueTasks: { inApp: true, email: false, push: false },
                    overdueTasks: { inApp: true, email: false, push: false },
                    dueProjects: { inApp: true, email: false, push: false },
                    overdueProjects: { inApp: true, email: false, push: false },
                    deferUntil: { inApp: true, email: false, push: false },
                },
                comment:
                    'User notification channel preferences for different notification types',
            }
        );
    },
};
