'use strict';

const { safeAddIndex } = require('../utils/migration-utils');

/**
 * Migration to add performance indexes to the tasks table.
 * These indexes improve query performance on slow I/O systems (e.g., Synology NAS with HDDs).
 *
 * Missing indexes identified from query analysis:
 * - status: Used in almost every task query
 * - due_date: Used in today/upcoming/overdue queries
 * - recurring_parent_id: Used in recurring task filtering
 * - completed_at: Used in completion queries
 * - Composite indexes for common query patterns
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Single column indexes for frequently filtered columns
        await safeAddIndex(queryInterface, 'tasks', ['status'], {
            name: 'tasks_status_idx',
        });

        await safeAddIndex(queryInterface, 'tasks', ['due_date'], {
            name: 'tasks_due_date_idx',
        });

        await safeAddIndex(queryInterface, 'tasks', ['recurring_parent_id'], {
            name: 'tasks_recurring_parent_id_idx',
        });

        await safeAddIndex(queryInterface, 'tasks', ['completed_at'], {
            name: 'tasks_completed_at_idx',
        });

        // Composite indexes for common query patterns
        await safeAddIndex(queryInterface, 'tasks', ['user_id', 'status'], {
            name: 'tasks_user_id_status_idx',
        });

        await safeAddIndex(
            queryInterface,
            'tasks',
            ['user_id', 'status', 'parent_task_id'],
            {
                name: 'tasks_user_status_parent_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'tasks',
            ['user_id', 'due_date', 'status'],
            {
                name: 'tasks_user_due_date_status_idx',
            }
        );

        await safeAddIndex(
            queryInterface,
            'tasks',
            ['user_id', 'completed_at', 'status'],
            {
                name: 'tasks_user_completed_at_status_idx',
            }
        );
    },

    async down(queryInterface, Sequelize) {
        // Remove indexes in reverse order
        const indexNames = [
            'tasks_user_completed_at_status_idx',
            'tasks_user_due_date_status_idx',
            'tasks_user_status_parent_idx',
            'tasks_user_id_status_idx',
            'tasks_completed_at_idx',
            'tasks_recurring_parent_id_idx',
            'tasks_due_date_idx',
            'tasks_status_idx',
        ];

        for (const indexName of indexNames) {
            try {
                await queryInterface.removeIndex('tasks', indexName);
            } catch (error) {
                console.log(
                    `Index ${indexName} may not exist, skipping removal`
                );
            }
        }
    },
};
