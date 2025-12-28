'use strict';

/**
 * Migration to rename project 'state' column to 'status' for consistency.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.renameColumn('projects', 'state', 'status');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.renameColumn('projects', 'status', 'state');
    },
};
