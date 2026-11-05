'use strict';

const { customAlphabet } = require('nanoid');

const generateUid = customAlphabet('0123456789abcdefghijkmnpqrstuvwxyz', 15);

module.exports = {
    async up(queryInterface) {
        const users = await queryInterface.sequelize.query(
            'SELECT id FROM users',
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        const now = new Date().toISOString();

        for (const user of users) {
            const existing = await queryInterface.sequelize.query(
                'SELECT id FROM tags WHERE user_id = ? AND name = ?',
                {
                    replacements: [user.id, 'today'],
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                }
            );

            if (existing.length === 0) {
                await queryInterface.sequelize.query(
                    'INSERT INTO tags (uid, name, tag_type, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    {
                        replacements: [
                            generateUid(),
                            'today',
                            'system',
                            user.id,
                            now,
                            now,
                        ],
                    }
                );
            } else {
                await queryInterface.sequelize.query(
                    'UPDATE tags SET tag_type = ? WHERE user_id = ? AND name = ?',
                    { replacements: ['system', user.id, 'today'] }
                );
            }
        }
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(
            "DELETE FROM tags WHERE name = 'today' AND tag_type = 'system'"
        );
    },
};
