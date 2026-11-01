'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

// The IP a signup came from - an abuse/debugging trail, not attribution.
// Nullable: rows written before this migration have none, and the request
// can itself arrive with no IP in edge cases (see waitlistService.capture).
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'waitlist_subscribers', [
            {
                name: 'ip_address',
                definition: { type: Sequelize.STRING(45), allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('waitlist_subscribers', 'ip_address');
    },
};
