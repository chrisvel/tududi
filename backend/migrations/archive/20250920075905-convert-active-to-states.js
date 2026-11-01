'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            const tableInfo = await queryInterface.describeTable('projects');

            // Only migrate if 'active' column exists
            if ('active' in tableInfo) {
                await queryInterface.sequelize.query(`
                    UPDATE projects
                    SET state = CASE
                        WHEN active = 1 THEN 'in_progress'
                        ELSE 'idea'
                    END
                `);
            } else {
                console.log(
                    'Column active does not exist in projects table, skipping data migration'
                );
            }
        } catch (error) {
            console.log(
                'Migration error converting active to states:',
                error.message
            );
            // Don't throw - allow migration to continue since state column already exists
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            const tableInfo = await queryInterface.describeTable('projects');

            // Only rollback if 'active' column exists
            if ('active' in tableInfo) {
                await queryInterface.sequelize.query(`
                    UPDATE projects
                    SET active = CASE
                        WHEN state = 'in_progress' THEN 1
                        ELSE 0
                    END
                `);
            }
        } catch (error) {
            console.log(
                'Migration rollback error for active column:',
                error.message
            );
        }
    },
};
