'use strict';

const { v4: uuidv4 } = require('uuid');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'uuid',
                definition: {
                    type: Sequelize.UUID,
                    allowNull: true,
                },
            },
        ]);

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

        await safeAddIndex(queryInterface, 'tasks', ['uuid'], {
            unique: true,
            name: 'tasks_uuid_unique',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('tasks', 'tasks_uuid_unique');

        await queryInterface.removeColumn('tasks', 'uuid');
    },
};
