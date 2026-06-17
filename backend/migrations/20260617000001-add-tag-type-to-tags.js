'use strict';

const { customAlphabet } = require('nanoid');

const generateUid = customAlphabet('0123456789abcdefghijkmnpqrstuvwxyz', 15);

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add tag_type column if it doesn't already exist
        const tableDesc = await queryInterface.describeTable('tags');
        if (!tableDesc.tag_type) {
            await queryInterface.addColumn('tags', 'tag_type', {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'user',
            });
        }

        // Create or update "someday" system tag for every existing user
        const users = await queryInterface.sequelize.query(
            'SELECT id FROM users',
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        const now = new Date().toISOString();

        for (const user of users) {
            const existing = await queryInterface.sequelize.query(
                'SELECT id FROM tags WHERE user_id = ? AND name = ?',
                {
                    replacements: [user.id, 'someday'],
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                }
            );

            if (existing.length === 0) {
                await queryInterface.sequelize.query(
                    'INSERT INTO tags (uid, name, tag_type, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    {
                        replacements: [
                            generateUid(),
                            'someday',
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
                    { replacements: ['system', user.id, 'someday'] }
                );
            }
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tags', 'tag_type');
    },
};
