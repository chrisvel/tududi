'use strict';

const { customAlphabet } = require('nanoid');

module.exports = {
    async up(queryInterface) {
        const generate = customAlphabet(
            '0123456789abcdefghijkmnpqrstuvwxyz',
            15
        );

        const users = await queryInterface.sequelize.query(
            'SELECT id, email, name, surname FROM users',
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        for (const user of users) {
            const existing = await queryInterface.sequelize.query(
                'SELECT id FROM people WHERE user_id = :userId AND linked_user_id = :userId LIMIT 1',
                {
                    replacements: { userId: user.id },
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                }
            );
            if (existing.length > 0) continue;

            const nameParts = [user.name, user.surname].filter(Boolean);
            let personName =
                nameParts.length > 0
                    ? nameParts.join(' ').trim()
                    : user.email.split('@')[0];

            const nameConflict = await queryInterface.sequelize.query(
                'SELECT id FROM people WHERE user_id = :userId AND name = :name LIMIT 1',
                {
                    replacements: { userId: user.id, name: personName },
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                }
            );
            if (nameConflict.length > 0) {
                personName = personName + ' (me)';
            }

            const uid = generate();
            await queryInterface.sequelize.query(
                `INSERT INTO people (uid, user_id, linked_user_id, name, email, relationship_type, archived, created_at, updated_at)
                 VALUES (:uid, :userId, :userId, :name, :email, 'other', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                {
                    replacements: {
                        uid,
                        userId: user.id,
                        name: personName,
                        email: user.email || null,
                    },
                }
            );
        }
    },

    async down() {
        // Self-persons created by this migration cannot be safely removed
        // without risking deletion of user-modified person entries
    },
};
