'use strict';

const {
    safeRemoveColumn,
    safeAddColumns,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Check if migration has already been applied by looking for tasks with recurring_parent_id
        const instanceCount = await queryInterface.sequelize.query(
            `SELECT COUNT(*) as count FROM tasks WHERE recurring_parent_id IS NOT NULL`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        // If no instances exist, migration has likely already run, skip gracefully
        if (instanceCount[0].count === 0) {
            console.log(
                'No recurring instances found, migration may have already run'
            );
            await safeRemoveColumn(
                queryInterface,
                'tasks',
                'last_generated_date'
            );
            return;
        }

        const templates = await queryInterface.sequelize.query(
            `SELECT * FROM tasks WHERE recurrence_type != 'none' AND recurring_parent_id IS NULL`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        // Disable foreign key constraints for SQLite during deletion
        const dialect = queryInterface.sequelize.getDialect();
        if (dialect === 'sqlite') {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');
        }

        try {
            for (const template of templates) {
                const completedInstances = await queryInterface.sequelize.query(
                    `SELECT * FROM tasks
                     WHERE recurring_parent_id = :templateId
                     AND status IN (2, 3)
                     AND completed_at IS NOT NULL
                     ORDER BY completed_at ASC`,
                    {
                        replacements: { templateId: template.id },
                        type: Sequelize.QueryTypes.SELECT,
                    }
                );

                for (const instance of completedInstances) {
                    // Check if this completion record already exists to avoid duplicates
                    const existing = await queryInterface.sequelize.query(
                        `SELECT COUNT(*) as count FROM recurring_completions
                         WHERE task_id = :taskId
                         AND completed_at = :completedAt
                         AND original_due_date = :originalDueDate`,
                        {
                            replacements: {
                                taskId: template.id,
                                completedAt: instance.completed_at,
                                originalDueDate: instance.due_date,
                            },
                            type: Sequelize.QueryTypes.SELECT,
                        }
                    );

                    // Only insert if it doesn't already exist
                    if (existing[0].count === 0) {
                        await queryInterface.bulkInsert(
                            'recurring_completions',
                            [
                                {
                                    task_id: template.id,
                                    completed_at: instance.completed_at,
                                    original_due_date: instance.due_date,
                                    skipped: false,
                                    created_at: instance.completed_at,
                                },
                            ]
                        );
                    }
                }

                const nextInstance = await queryInterface.sequelize.query(
                    `SELECT * FROM tasks
                     WHERE recurring_parent_id = :templateId
                     AND status NOT IN (2, 3)
                     AND due_date >= date('now')
                     ORDER BY due_date ASC
                     LIMIT 1`,
                    {
                        replacements: { templateId: template.id },
                        type: Sequelize.QueryTypes.SELECT,
                    }
                );

                if (nextInstance.length > 0) {
                    await queryInterface.sequelize.query(
                        `UPDATE tasks SET due_date = :nextDue WHERE id = :templateId`,
                        {
                            replacements: {
                                nextDue: nextInstance[0].due_date,
                                templateId: template.id,
                            },
                        }
                    );
                }

                // Delete related records first to avoid foreign key constraints
                await queryInterface.sequelize.query(
                    `DELETE FROM tasks_tags WHERE task_id IN (SELECT id FROM tasks WHERE recurring_parent_id = :templateId)`,
                    { replacements: { templateId: template.id } }
                );

                await queryInterface.sequelize.query(
                    `DELETE FROM task_events WHERE task_id IN (SELECT id FROM tasks WHERE recurring_parent_id = :templateId)`,
                    { replacements: { templateId: template.id } }
                );

                await queryInterface.sequelize.query(
                    `DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE recurring_parent_id = :templateId)`,
                    { replacements: { templateId: template.id } }
                );

                await queryInterface.sequelize.query(
                    `DELETE FROM tasks WHERE recurring_parent_id = :templateId`,
                    { replacements: { templateId: template.id } }
                );
            }
        } finally {
            // Re-enable foreign key constraints
            if (dialect === 'sqlite') {
                await queryInterface.sequelize.query(
                    'PRAGMA foreign_keys = ON;'
                );
            }
        }

        await safeRemoveColumn(queryInterface, 'tasks', 'last_generated_date');
    },

    async down(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'last_generated_date',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
            },
        ]);
    },
};
