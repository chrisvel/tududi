'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Update all projects: active=true -> state='in_progress', active=false -> state='idea'
        await queryInterface.sequelize.query(`
            UPDATE projects
            SET state = CASE
                WHEN active = 1 THEN 'in_progress'
                ELSE 'idea'
            END
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Reverse the conversion: state='in_progress' -> active=true, others -> active=false
        await queryInterface.sequelize.query(`
            UPDATE projects
            SET active = CASE
                WHEN state = 'in_progress' THEN 1
                ELSE 0
            END
        `);
    },
};