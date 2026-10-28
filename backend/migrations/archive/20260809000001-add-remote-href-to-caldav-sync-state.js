'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

const INDEX_NAME = 'caldav_sync_state_calendar_href_idx';

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'caldav_sync_state', [
            {
                name: 'remote_href',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
        ]);

        // Not safeAddIndex: it treats an index as present when any one of the
        // requested fields is already indexed, and calendar_id is, so the
        // composite index would silently never be created.
        const indexes = await queryInterface.showIndex('caldav_sync_state');
        if (!indexes.some((index) => index.name === INDEX_NAME)) {
            await queryInterface.addIndex(
                'caldav_sync_state',
                ['calendar_id', 'remote_href'],
                { name: INDEX_NAME }
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('caldav_sync_state', INDEX_NAME);
        await queryInterface.removeColumn('caldav_sync_state', 'remote_href');
    },
};
