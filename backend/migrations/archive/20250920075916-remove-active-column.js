'use strict';

const {
    safeRemoveColumn,
    safeAddColumns,
} = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Remove the active column from projects table
        await safeRemoveColumn(queryInterface, 'projects', 'active');
    },

    down: async (queryInterface, Sequelize) => {
        // Add the active column back
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'active',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
            },
        ]);

        // Restore active values based on state
        await queryInterface.sequelize.query(`
            UPDATE projects
            SET active = CASE
                WHEN state = 'in_progress' THEN 1
                ELSE 0
            END
        `);
    },
};
