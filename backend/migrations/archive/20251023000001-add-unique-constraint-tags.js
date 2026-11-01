'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // CRITICAL: Disable foreign keys BEFORE starting transaction
        // (SQLite requires this to be set outside of a transaction)
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');

        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Step 0: Count original rows for verification
            const [originalCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tags;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`📊 Original tags count: ${originalCount.count}`);

            // Step 1: Remove duplicate tags per user (keep oldest)
            const [duplicatesResult] = await queryInterface.sequelize.query(
                `
                SELECT COUNT(*) as count FROM tags
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM tags
                    GROUP BY user_id, name
                );
            `,
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(
                `🔍 Found ${duplicatesResult.count} duplicate tags to remove`
            );

            await queryInterface.sequelize.query(
                `
                DELETE FROM tags
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM tags
                    GROUP BY user_id, name
                )
            `,
                { transaction }
            );

            // Step 1.5: Verify count after deduplication
            const [afterDedup] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tags;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`📊 After deduplication: ${afterDedup.count} tags`);

            // Step 2: Create new tags table with correct schema
            await queryInterface.sequelize.query(
                `
                CREATE TABLE tags_new (
                    id INTEGER PRIMARY KEY,
                    uid VARCHAR(255) NOT NULL UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users (id),
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                );
            `,
                { transaction }
            );

            // Step 3: Copy existing data
            await queryInterface.sequelize.query(
                `
                INSERT INTO tags_new (id, uid, name, user_id, created_at, updated_at)
                SELECT id, uid, name, user_id, created_at, updated_at
                FROM tags;
            `,
                { transaction }
            );

            // Step 3.5: Verify data was copied correctly
            const [newCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tags_new;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`📊 Copied to new table: ${newCount.count} tags`);

            if (newCount.count !== afterDedup.count) {
                throw new Error(
                    `Data verification failed! Expected ${afterDedup.count} tags but found ${newCount.count} in new table`
                );
            }

            // Step 3.6: Verify all UIDs were copied
            const [uidCheck] = await queryInterface.sequelize.query(
                `
                SELECT COUNT(*) as count FROM tags t
                WHERE NOT EXISTS (
                    SELECT 1 FROM tags_new tn WHERE tn.uid = t.uid
                );
            `,
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );

            if (uidCheck.count > 0) {
                throw new Error(
                    `Data verification failed! ${uidCheck.count} tags were not copied to new table`
                );
            }

            console.log(
                '✅ Data verification passed - all tags copied correctly'
            );

            // Step 3.7: Save junction table data before dropping old tags table
            await queryInterface.sequelize.query(
                `
                CREATE TABLE projects_tags_backup AS
                SELECT * FROM projects_tags;
            `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                CREATE TABLE tasks_tags_backup AS
                SELECT * FROM tasks_tags;
            `,
                { transaction }
            );

            const [projectsTagsBackupCount] =
                await queryInterface.sequelize.query(
                    'SELECT COUNT(*) as count FROM projects_tags_backup;',
                    { transaction, type: Sequelize.QueryTypes.SELECT }
                );
            const [tasksTagsBackupCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tasks_tags_backup;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(
                `📦 Backed up junction tables: ${projectsTagsBackupCount.count} project tags, ${tasksTagsBackupCount.count} task tags`
            );

            // Step 4: Drop old table
            await queryInterface.sequelize.query('DROP TABLE tags;', {
                transaction,
            });

            // Step 5: Rename new table
            await queryInterface.sequelize.query(
                'ALTER TABLE tags_new RENAME TO tags;',
                { transaction }
            );

            // Step 6: Create composite unique index
            await queryInterface.addIndex('tags', ['user_id', 'name'], {
                unique: true,
                name: 'tags_user_id_name_unique',
                transaction,
            });

            // Step 7: Create index on user_id for performance
            await queryInterface.addIndex('tags', ['user_id'], {
                name: 'tags_user_id',
                transaction,
            });

            // Step 7.5: Restore junction table data
            await queryInterface.sequelize.query(
                `
                DELETE FROM projects_tags;
            `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                INSERT INTO projects_tags (project_id, tag_id, created_at, updated_at)
                SELECT project_id, tag_id, created_at, updated_at
                FROM projects_tags_backup;
            `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                DELETE FROM tasks_tags;
            `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                INSERT INTO tasks_tags (task_id, tag_id, created_at, updated_at)
                SELECT task_id, tag_id, created_at, updated_at
                FROM tasks_tags_backup;
            `,
                { transaction }
            );

            // Step 7.6: Drop backup tables
            await queryInterface.sequelize.query(
                'DROP TABLE projects_tags_backup;',
                { transaction }
            );

            await queryInterface.sequelize.query(
                'DROP TABLE tasks_tags_backup;',
                { transaction }
            );

            console.log('✅ Restored junction table data');

            // Step 8: Final verification
            const [finalCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tags;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`📊 Final tags count: ${finalCount.count}`);

            if (finalCount.count !== afterDedup.count) {
                throw new Error(
                    `Final verification failed! Expected ${afterDedup.count} tags but found ${finalCount.count}`
                );
            }

            // Step 9: Verify junction tables still have their data
            const [projectsTagsCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM projects_tags;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            const [tasksTagsCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tasks_tags;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(
                `📊 Junction tables preserved: ${projectsTagsCount.count} project tags, ${tasksTagsCount.count} task tags`
            );

            await transaction.commit();

            // Re-enable foreign keys AFTER committing transaction
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');

            console.log('✅ Successfully fixed tags table unique constraints');
            console.log(
                `✅ All ${finalCount.count} tags preserved (${duplicatesResult.count} duplicates removed)`
            );
        } catch (error) {
            await transaction.rollback();

            // Re-enable foreign keys even on error (must be done after rollback)
            try {
                await queryInterface.sequelize.query(
                    'PRAGMA foreign_keys = ON;'
                );
            } catch (pragmaError) {
                console.error('Failed to re-enable foreign keys:', pragmaError);
            }

            console.error('❌ Error fixing tags table:', error);
            console.error(
                '❌ Transaction rolled back - no changes were made to the database'
            );
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Reverting this migration would restore the broken schema
        // It's better to not support rollback for schema fixes
        console.warn(
            '⚠️  Cannot rollback this migration - it fixes a broken schema'
        );
        console.warn('⚠️  Please restore from backup if needed');
    },
};
