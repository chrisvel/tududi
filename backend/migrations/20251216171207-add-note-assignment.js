'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add assigned_to_user_id column to notes table
        await safeAddColumns(queryInterface, 'notes', [
            {
                name: 'assigned_to_user_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL', // Keep note if assignee is deleted
                },
            },
        ]);
        // Add index for performance on assigned notes queries
        await safeAddIndex(queryInterface, 'notes', ['assigned_to_user_id'], {
            name: 'notes_assigned_to_user_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove index first
        await queryInterface.removeIndex(
            'notes',
            'notes_assigned_to_user_id_idx'
        );

        // Remove column
        await queryInterface.removeColumn('notes', 'assigned_to_user_id');
    },
};
