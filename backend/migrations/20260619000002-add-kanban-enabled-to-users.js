'use strict';

module.exports = {
    async up(queryInterface) {
        const [users] = await queryInterface.sequelize.query(
            `SELECT id, features FROM users WHERE features IS NOT NULL`
        );

        for (const user of users) {
            let features;
            try {
                features =
                    typeof user.features === 'string'
                        ? JSON.parse(user.features)
                        : user.features;
            } catch {
                features = {};
            }

            if (!('kanban_enabled' in features)) {
                features.kanban_enabled = false;
                await queryInterface.sequelize.query(
                    'UPDATE users SET features = :features WHERE id = :id',
                    {
                        replacements: {
                            features: JSON.stringify(features),
                            id: user.id,
                        },
                    }
                );
            }
        }
    },

    async down() {
        // No rollback — removing a key from JSON is destructive and not needed
    },
};
