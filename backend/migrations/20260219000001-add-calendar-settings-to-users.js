'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'calendar_settings',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: {
                        enabled: false,
                        icsUrl: '',
                        syncPreset: '6h',
                        lastSyncedAt: null,
                        lastSyncError: null,
                        etag: null,
                        lastModified: null,
                    },
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'calendar_settings');
    },
};
