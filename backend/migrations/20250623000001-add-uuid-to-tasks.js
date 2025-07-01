'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add UUID column to tasks table (without unique constraint initially)
        await queryInterface.addColumn('tasks', 'uuid', {
            type: Sequelize.UUID,
            allowNull: true,
        });

        // Backfill existing tasks with UUIDs
        const tasks = await queryInterface.sequelize.query(
            'SELECT id FROM tasks WHERE uuid IS NULL',
            { type: Sequelize.QueryTypes.SELECT }
        );

        for (const task of tasks) {
            const uuid = uuidv4();
            await queryInterface.sequelize.query(
                'UPDATE tasks SET uuid = ? WHERE id = ?',
                { replacements: [uuid, task.id] }
            );
        }

        // Add unique index for UUID
        await queryInterface.addIndex('tasks', ['uuid'], {
            unique: true,
            name: 'tasks_uuid_unique',
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove index first
        await queryInterface.removeIndex('tasks', 'tasks_uuid_unique');

        // Remove UUID column
        await queryInterface.removeColumn('tasks', 'uuid');
    },
};
