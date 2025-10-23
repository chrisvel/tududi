'use strict';

const { safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // First, remove any duplicate tags per user
        // This query keeps the oldest tag and removes duplicates
        await queryInterface.sequelize.query(`
            DELETE FROM tags
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM tags
                GROUP BY user_id, name
            )
        `);

        // Add unique constraint on user_id and name combination
        await safeAddIndex(queryInterface, 'tags', ['user_id', 'name'], {
            unique: true,
            name: 'tags_user_id_name_unique',
        });
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the unique index
        try {
            await queryInterface.removeIndex(
                'tags',
                'tags_user_id_name_unique'
            );
        } catch (error) {
            console.log('Index may not exist:', error.message);
        }
    },
};
