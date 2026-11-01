'use strict';

const { safeChangeColumn } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        for (const user of users) {
            let prefs = user.notification_preferences;
            if (typeof prefs === 'string') {
                try {
                    prefs = JSON.parse(prefs);
                } catch {
                    continue;
                }
            }

            let needsUpdate = false;
            if (prefs.dueTasks && prefs.dueTasks.telegram === undefined) {
                prefs.dueTasks.telegram = false;
                needsUpdate = true;
            }
            if (
                prefs.overdueTasks &&
                prefs.overdueTasks.telegram === undefined
            ) {
                prefs.overdueTasks.telegram = false;
                needsUpdate = true;
            }
            if (prefs.dueProjects && prefs.dueProjects.telegram === undefined) {
                prefs.dueProjects.telegram = false;
                needsUpdate = true;
            }
            if (
                prefs.overdueProjects &&
                prefs.overdueProjects.telegram === undefined
            ) {
                prefs.overdueProjects.telegram = false;
                needsUpdate = true;
            }
            if (prefs.deferUntil && prefs.deferUntil.telegram === undefined) {
                prefs.deferUntil.telegram = false;
                needsUpdate = true;
            }

            if (needsUpdate) {
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
        }

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
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        for (const user of users) {
            let prefs = user.notification_preferences;
            if (typeof prefs === 'string') {
                try {
                    prefs = JSON.parse(prefs);
                } catch {
                    continue;
                }
            }

            let needsUpdate = false;
            if (prefs.dueTasks && prefs.dueTasks.telegram !== undefined) {
                delete prefs.dueTasks.telegram;
                needsUpdate = true;
            }
            if (
                prefs.overdueTasks &&
                prefs.overdueTasks.telegram !== undefined
            ) {
                delete prefs.overdueTasks.telegram;
                needsUpdate = true;
            }
            if (prefs.dueProjects && prefs.dueProjects.telegram !== undefined) {
                delete prefs.dueProjects.telegram;
                needsUpdate = true;
            }
            if (
                prefs.overdueProjects &&
                prefs.overdueProjects.telegram !== undefined
            ) {
                delete prefs.overdueProjects.telegram;
                needsUpdate = true;
            }
            if (prefs.deferUntil && prefs.deferUntil.telegram !== undefined) {
                delete prefs.deferUntil.telegram;
                needsUpdate = true;
            }

            if (needsUpdate) {
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
        }

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
