'use strict';

// Backfill the `taskAssigned` key into every user's notification_preferences.
// New rows get it from the Sequelize model default and every app write path
// passes a full preferences object, so no DB-level column default change is
// needed (and a SQLite column rebuild on the wide users table is best avoided).

const CHANNELS = { inApp: true, email: false, push: false, telegram: false };

function parsePrefs(raw) {
    let prefs = raw;
    for (let i = 0; i < 2 && typeof prefs === 'string'; i++) {
        try {
            prefs = JSON.parse(prefs);
        } catch {
            return null;
        }
    }
    return prefs && typeof prefs === 'object' ? prefs : null;
}

module.exports = {
    async up(queryInterface) {
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        for (const user of users) {
            const prefs = parsePrefs(user.notification_preferences);
            if (!prefs || prefs.taskAssigned) continue;

            prefs.taskAssigned = { ...CHANNELS };
            await queryInterface.sequelize.query(
                'UPDATE users SET notification_preferences = :prefs WHERE id = :id',
                { replacements: { prefs: JSON.stringify(prefs), id: user.id } }
            );
        }
    },

    async down(queryInterface) {
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        for (const user of users) {
            const prefs = parsePrefs(user.notification_preferences);
            if (!prefs || !prefs.taskAssigned) continue;

            delete prefs.taskAssigned;
            await queryInterface.sequelize.query(
                'UPDATE users SET notification_preferences = :prefs WHERE id = :id',
                { replacements: { prefs: JSON.stringify(prefs), id: user.id } }
            );
        }
    },
};
