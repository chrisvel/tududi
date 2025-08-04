'use strict';

const { nanoid } = require('nanoid/non-secure');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Temporarily disable foreign key constraints
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            // Safely add nanoid column to projects table
            await safeAddColumns(queryInterface, 'projects', [
                {
                    name: 'nanoid',
                    definition: {
                        type: Sequelize.STRING(21), // nanoid default length is 21
                        allowNull: true, // Initially allow null, we'll populate it then make it not null
                    },
                },
            ]);

            // Get all existing projects that don't have nanoid yet
            const projects = await queryInterface.sequelize.query(
                'SELECT id FROM projects WHERE nanoid IS NULL',
                { type: Sequelize.QueryTypes.SELECT }
            );

            // Generate and update nanoid for each existing project
            for (const project of projects) {
                const projectNanoid = nanoid();
                await queryInterface.sequelize.query(
                    'UPDATE projects SET nanoid = ? WHERE id = ?',
                    {
                        replacements: [projectNanoid, project.id],
                        type: Sequelize.QueryTypes.UPDATE,
                    }
                );
            }

            // Now make the column not null since all existing projects have nanoids
            try {
                await queryInterface.changeColumn('projects', 'nanoid', {
                    type: Sequelize.STRING(21),
                    allowNull: false,
                });
            } catch (error) {
                console.log('Column already exists with correct constraints');
            }

            // Add index for performance
            await safeAddIndex(queryInterface, 'projects', ['nanoid'], {
                unique: true,
                name: 'projects_nanoid_unique_index',
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
                'projects',
                'projects_nanoid_unique_index'
            );
        } catch (error) {
            // Index might not exist
        }

        // Remove the nanoid column
        await queryInterface.removeColumn('projects', 'nanoid');
    },
};
