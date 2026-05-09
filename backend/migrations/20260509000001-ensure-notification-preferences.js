'use strict';

/**
 * Migration to ensure all users have notification_preferences properly initialized.
 *
 * This migration backfills notification_preferences for any users who have NULL values.
 * This can happen for users created before notification_preferences were added,
 * or if Sequelize default values didn't apply correctly.
 *
 * Related to issue #1003: Test notification errors on new setups
 */

const DEFAULT_PREFERENCES = {
    dueTasks: { inApp: true, email: false, push: false, telegram: false },
    overdueTasks: { inApp: true, email: false, push: false, telegram: false },
    dueProjects: { inApp: true, email: false, push: false, telegram: false },
    overdueProjects: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
    },
    deferUntil: { inApp: true, email: false, push: false, telegram: false },
};

module.exports = {
    async up(queryInterface, Sequelize) {
        // Find all users with NULL notification_preferences
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NULL'
        );

        console.log(
            `Found ${users.length} users with NULL notification_preferences`
        );

        // Update each user with default preferences
        for (const user of users) {
            await queryInterface.sequelize.query(
                'UPDATE users SET notification_preferences = :prefs WHERE id = :id',
                {
                    replacements: {
                        prefs: JSON.stringify(DEFAULT_PREFERENCES),
                        id: user.id,
                    },
                }
            );
        }

        console.log(
            `Updated ${users.length} users with default notification_preferences`
        );

        // Also check for users with incomplete notification_preferences
        // (missing deferUntil, which was added later)
        const [usersWithPrefs] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        let updatedCount = 0;
        for (const user of usersWithPrefs) {
            const prefs = user.notification_preferences;
            let needsUpdate = false;

            // Check if all required keys exist
            for (const key of Object.keys(DEFAULT_PREFERENCES)) {
                if (!prefs[key]) {
                    prefs[key] = DEFAULT_PREFERENCES[key];
                    needsUpdate = true;
                } else {
                    // Ensure all channels exist
                    for (const channel of [
                        'inApp',
                        'email',
                        'push',
                        'telegram',
                    ]) {
                        if (prefs[key][channel] === undefined) {
                            prefs[key][channel] =
                                DEFAULT_PREFERENCES[key][channel];
                            needsUpdate = true;
                        }
                    }
                }
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
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            console.log(
                `Updated ${updatedCount} users with incomplete notification_preferences`
            );
        }
    },

    async down(queryInterface, Sequelize) {
        // This migration is idempotent and safe - no need to rollback
        // Rolling back would set preferences to NULL which could break functionality
        console.log(
            'Skipping rollback for notification_preferences migration (idempotent)'
        );
    },
};
