'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

const INDEX_NAME = 'tasks_caldav_resource_name';

// A CalDAV resource URL is arbitrary and need not match the UID inside the
// object (RFC 4791 5.3.2), so a task that a client created has two names: the
// UID it put in the VTODO, which is its identity, and the resource name it
// uploaded under, which is its URL. Storing the second one is what lets Tududi
// answer the client at the URL it chose without pretending the URL is the
// identity - the confusion that made a client see its own task change identity
// and re-upload it forever (#1371).
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'caldav_resource_name',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['caldav_resource_name'], {
            name: INDEX_NAME,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', INDEX_NAME);
        await queryInterface.removeColumn('tasks', 'caldav_resource_name');
    },
};
