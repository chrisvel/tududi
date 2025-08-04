'use strict';

const { nanoid } = require('nanoid/non-secure');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Temporarily disable foreign key constraints
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            // Safely add nanoid column to tags table
            await safeAddColumns(queryInterface, 'tags', [
                {
                    name: 'nanoid',
                    definition: {
                        type: Sequelize.STRING(21), // nanoid default length is 21
                        allowNull: true, // Initially allow null, we'll populate it then make it not null
                    },
                },
            ]);

            // Get all existing tags that don't have nanoid yet
            const tags = await queryInterface.sequelize.query(
                'SELECT id FROM tags WHERE nanoid IS NULL',
                { type: Sequelize.QueryTypes.SELECT }
            );

            // Generate and update nanoid for each existing tag
            for (const tag of tags) {
                const tagNanoid = nanoid();
                await queryInterface.sequelize.query(
                    'UPDATE tags SET nanoid = ? WHERE id = ?',
                    {
                        replacements: [tagNanoid, tag.id],
                        type: Sequelize.QueryTypes.UPDATE,
                    }
                );
            }

            // Now make the column not null since all existing tags have nanoids
            try {
                await queryInterface.changeColumn('tags', 'nanoid', {
                    type: Sequelize.STRING(21),
                    allowNull: false,
                });
            } catch (error) {
                console.log('Column already exists with correct constraints');
            }

            // Add index for performance
            await safeAddIndex(queryInterface, 'tags', ['nanoid'], {
                unique: true,
                name: 'tags_nanoid_unique_index',
            });
        } finally {
            // Re-enable foreign key constraints
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
        }
    },

    async down(queryInterface, Sequelize) {
        // Remove the index first
        try {
            await queryInterface.removeIndex(
                'tags',
                'tags_nanoid_unique_index'
            );
        } catch (error) {
            // Index might not exist
        }

        // Remove the nanoid column
        await queryInterface.removeColumn('tags', 'nanoid');
    },
};
