'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Update existing users to have assignment notification preferences
        const users = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users',
            { type: Sequelize.QueryTypes.SELECT }
        );

        for (const user of users) {
            let prefs;
            try {
                prefs = user.notification_preferences ? JSON.parse(user.notification_preferences) : {};
            } catch (e) {
                prefs = {};
            }

            // Add assignment notification preferences if they don't exist
            if (!prefs.taskAssigned) {
                prefs.taskAssigned = {
                    inApp: true,
                    email: false,
                    push: false,
                    telegram: false,
                };
            }

            if (!prefs.taskUnassigned) {
                prefs.taskUnassigned = {
                    inApp: true,
                    email: false,
                    push: false,
                    telegram: false,
                };
            }

            if (!prefs.assignedTaskCompleted) {
                prefs.assignedTaskCompleted = {
                    inApp: true,
                    email: false,
                    push: false,
                    telegram: false,
                };
            }

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
    },

    async down(queryInterface, Sequelize) {
        // Not reversible - we don't want to delete user preferences
        // Users may have customized these settings
    },
};
