'use strict';

/**
 * Migration to update project state ENUM to use task status values.
 * This aligns project states with task statuses for consistency.
 *
 * Old values: 'idea', 'planned', 'in_progress', 'blocked', 'completed'
 * New values: 'not_started', 'in_progress', 'done', 'waiting', 'cancelled', 'planned'
 *
 * Mapping:
 * - 'idea' → 'not_started'
 * - 'planned' → 'planned'
 * - 'in_progress' → 'in_progress'
 * - 'blocked' → 'waiting'
 * - 'completed' → 'done'
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // For SQLite: recreate the column with new values
        // For PostgreSQL/MySQL: alter the enum type

        const dialect = queryInterface.sequelize.getDialect();

        if (dialect === 'sqlite') {
            // SQLite doesn't support ENUM, it's stored as TEXT
            // Just update the data values
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'not_started' WHERE state = 'idea'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'waiting' WHERE state = 'blocked'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'done' WHERE state = 'completed'`
            );
        } else if (dialect === 'postgres') {
            // PostgreSQL: Create new enum type, migrate data, swap types
            await queryInterface.sequelize.query(`
                CREATE TYPE "enum_projects_state_new" AS ENUM(
                    'not_started', 'in_progress', 'done', 'waiting', 'cancelled', 'planned'
                );
            `);

            // Update values before changing type
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'not_started' WHERE state = 'idea'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'waiting' WHERE state = 'blocked'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'done' WHERE state = 'completed'`
            );

            // Change column type
            await queryInterface.sequelize.query(`
                ALTER TABLE projects
                ALTER COLUMN state TYPE "enum_projects_state_new"
                USING state::text::"enum_projects_state_new";
            `);

            // Drop old enum and rename new one
            await queryInterface.sequelize.query(
                `DROP TYPE IF EXISTS "enum_projects_state";`
            );
            await queryInterface.sequelize.query(
                `ALTER TYPE "enum_projects_state_new" RENAME TO "enum_projects_state";`
            );

            // Update default value
            await queryInterface.sequelize.query(`
                ALTER TABLE projects ALTER COLUMN state SET DEFAULT 'not_started';
            `);
        } else if (dialect === 'mysql' || dialect === 'mariadb') {
            // MySQL: Alter column directly
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'not_started' WHERE state = 'idea'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'waiting' WHERE state = 'blocked'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'done' WHERE state = 'completed'`
            );

            await queryInterface.changeColumn('projects', 'state', {
                type: Sequelize.ENUM(
                    'not_started',
                    'in_progress',
                    'done',
                    'waiting',
                    'cancelled',
                    'planned'
                ),
                allowNull: false,
                defaultValue: 'not_started',
            });
        }
    },

    async down(queryInterface, Sequelize) {
        const dialect = queryInterface.sequelize.getDialect();

        if (dialect === 'sqlite') {
            // Reverse the data mapping
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'idea' WHERE state = 'not_started'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'blocked' WHERE state = 'waiting'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'completed' WHERE state = 'done'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'idea' WHERE state = 'cancelled'`
            );
        } else if (dialect === 'postgres') {
            await queryInterface.sequelize.query(`
                CREATE TYPE "enum_projects_state_old" AS ENUM(
                    'idea', 'planned', 'in_progress', 'blocked', 'completed'
                );
            `);

            // Reverse data mapping
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'idea' WHERE state = 'not_started'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'blocked' WHERE state = 'waiting'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'completed' WHERE state = 'done'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'idea' WHERE state = 'cancelled'`
            );

            await queryInterface.sequelize.query(`
                ALTER TABLE projects
                ALTER COLUMN state TYPE "enum_projects_state_old"
                USING state::text::"enum_projects_state_old";
            `);

            await queryInterface.sequelize.query(
                `DROP TYPE IF EXISTS "enum_projects_state";`
            );
            await queryInterface.sequelize.query(
                `ALTER TYPE "enum_projects_state_old" RENAME TO "enum_projects_state";`
            );

            await queryInterface.sequelize.query(`
                ALTER TABLE projects ALTER COLUMN state SET DEFAULT 'idea';
            `);
        } else if (dialect === 'mysql' || dialect === 'mariadb') {
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'idea' WHERE state = 'not_started'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'blocked' WHERE state = 'waiting'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'completed' WHERE state = 'done'`
            );
            await queryInterface.sequelize.query(
                `UPDATE projects SET state = 'idea' WHERE state = 'cancelled'`
            );

            await queryInterface.changeColumn('projects', 'state', {
                type: Sequelize.ENUM(
                    'idea',
                    'planned',
                    'in_progress',
                    'blocked',
                    'completed'
                ),
                allowNull: false,
                defaultValue: 'idea',
            });
        }
    },
};
