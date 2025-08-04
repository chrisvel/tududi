'use strict';

const { nanoid } = require('nanoid/non-secure');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Temporarily disable foreign key constraints
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            // Safely add nanoid column to notes table
            await safeAddColumns(queryInterface, 'notes', [
                {
                    name: 'nanoid',
                    definition: {
                        type: Sequelize.STRING(21), // nanoid default length is 21
                        allowNull: true, // Initially allow null, we'll populate it then make it not null
                    },
                },
            ]);

            // Get all existing notes that don't have nanoid yet
            const notes = await queryInterface.sequelize.query(
                'SELECT id FROM notes WHERE nanoid IS NULL',
                { type: Sequelize.QueryTypes.SELECT }
            );

            // Generate and update nanoid for each existing note
            for (const note of notes) {
                const noteNanoid = nanoid();
                await queryInterface.sequelize.query(
                    'UPDATE notes SET nanoid = ? WHERE id = ?',
                    {
                        replacements: [noteNanoid, note.id],
                        type: Sequelize.QueryTypes.UPDATE,
                    }
                );
            }

            // Now make the column not null since all existing notes have nanoids
            try {
                await queryInterface.changeColumn('notes', 'nanoid', {
                    type: Sequelize.STRING(21),
                    allowNull: false,
                });
            } catch (error) {
                console.log('Column already exists with correct constraints');
            }

            // Add index for performance
            await safeAddIndex(queryInterface, 'notes', ['nanoid'], {
                unique: true,
                name: 'notes_nanoid_unique_index',
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
                'notes',
                'notes_nanoid_unique_index'
            );
        } catch (error) {
            // Index might not exist
        }

        // Remove the nanoid column
        await queryInterface.removeColumn('notes', 'nanoid');
    },
};
