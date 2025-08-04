'use strict';

const { nanoid } = require('nanoid/non-secure');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Temporarily disable foreign key constraints
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            // Safely add nanoid column to tasks table (without unique constraint initially)
            await safeAddColumns(queryInterface, 'tasks', [
                {
                    name: 'nanoid',
                    definition: {
                        type: Sequelize.STRING(21), // nanoid default length is 21
                        allowNull: true, // Initially allow null, we'll populate it then make it not null
                    },
                },
            ]);

            // Get all existing tasks that don't have nanoid yet
            const tasks = await queryInterface.sequelize.query(
                'SELECT id FROM tasks WHERE nanoid IS NULL',
                { type: Sequelize.QueryTypes.SELECT }
            );

            // Generate and update nanoid for each existing task
            for (const task of tasks) {
                const taskNanoid = nanoid();
                await queryInterface.sequelize.query(
                    'UPDATE tasks SET nanoid = ? WHERE id = ?',
                    {
                        replacements: [taskNanoid, task.id],
                        type: Sequelize.QueryTypes.UPDATE,
                    }
                );
            }

            // Now make the column not null since all existing tasks have nanoids
            try {
                await queryInterface.changeColumn('tasks', 'nanoid', {
                    type: Sequelize.STRING(21),
                    allowNull: false,
                });
            } catch (error) {
                console.log('Column already exists with correct constraints');
            }

            // Add index for performance
            await safeAddIndex(queryInterface, 'tasks', ['nanoid'], {
                unique: true,
                name: 'tasks_nanoid_unique_index',
            });
        } finally {
            // Re-enable foreign key constraints
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
        }
    },

    async down(queryInterface, Sequelize) {
        // Remove the index first
        await queryInterface.removeIndex('tasks', 'tasks_nanoid_unique_index');

        // Remove the nanoid column
        await queryInterface.removeColumn('tasks', 'nanoid');
    },
};
