'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'notification_preferences',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: {
                        dueTasks: { inApp: true, email: false, push: false },
                        overdueTasks: { inApp: true, email: false, push: false },
                        dueProjects: { inApp: true, email: false, push: false },
                        overdueProjects: { inApp: true, email: false, push: false },
                        deferUntil: { inApp: true, email: false, push: false },
                    },
                    comment: 'User notification channel preferences for different notification types',
                },
            },
        ]);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('users', 'notification_preferences');
    },
};
