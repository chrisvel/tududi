'use strict';

const {
    safeRemoveColumn,
    safeAddColumns,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        const templates = await queryInterface.sequelize.query(
            `SELECT * FROM tasks WHERE recurrence_type != 'none' AND recurring_parent_id IS NULL`,
            { type: Sequelize.QueryTypes.SELECT }
        );

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
                await queryInterface.bulkInsert('recurring_completions', [
                    {
                        task_id: template.id,
                        completed_at: instance.completed_at,
                        original_due_date: instance.due_date,
                        skipped: false,
                        created_at: instance.completed_at,
                    },
                ]);
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

            await queryInterface.sequelize.query(
                `DELETE FROM tasks WHERE recurring_parent_id = :templateId`,
                { replacements: { templateId: template.id } }
            );
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
