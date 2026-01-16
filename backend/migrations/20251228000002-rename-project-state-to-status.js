'use strict';

/**
 * Migration to rename project 'state' column to 'status' for consistency.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('projects');

        // Already renamed - skip
        if ('status' in tableInfo && !('state' in tableInfo)) {
            console.log(
                'Column already renamed from state to status, skipping'
            );
            return;
        }

        // Not yet renamed - do it
        if ('state' in tableInfo && !('status' in tableInfo)) {
            const dialect = queryInterface.sequelize.getDialect();
            if (dialect === 'sqlite') {
                // Use raw SQL for SQLite (supported in SQLite 3.25+)
                await queryInterface.sequelize.query(
                    'ALTER TABLE projects RENAME COLUMN state TO status;'
                );
            } else {
                await queryInterface.renameColumn(
                    'projects',
                    'state',
                    'status'
                );
            }
            console.log('Successfully renamed column state to status');
            return;
        }

        // Edge case: both exist or neither exists
        console.log(
            'Unexpected state: state=' +
                ('state' in tableInfo) +
                ', status=' +
                ('status' in tableInfo)
        );
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('projects');

        // Already reverted - skip
        if ('state' in tableInfo && !('status' in tableInfo)) {
            console.log(
                'Column already renamed from status to state, skipping'
            );
            return;
        }

        // Not yet reverted - do it
        if ('status' in tableInfo && !('state' in tableInfo)) {
            const dialect = queryInterface.sequelize.getDialect();
            if (dialect === 'sqlite') {
                await queryInterface.sequelize.query(
                    'ALTER TABLE projects RENAME COLUMN status TO state;'
                );
            } else {
                await queryInterface.renameColumn(
                    'projects',
                    'status',
                    'state'
                );
            }
            console.log('Successfully renamed column status to state');
            return;
        }

        console.log(
            'Unexpected state: state=' +
                ('state' in tableInfo) +
                ', status=' +
                ('status' in tableInfo)
        );
    },
};
