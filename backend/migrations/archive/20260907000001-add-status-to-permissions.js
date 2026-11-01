'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

// Shares now need the recipient's consent. Rows that existed before this
// migration were granted under the old "push into their sidebar" model, so
// they stay accepted; only new grants start as pending.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'permissions', [
            {
                name: 'status',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'accepted',
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('permissions', 'status');
    },
};
