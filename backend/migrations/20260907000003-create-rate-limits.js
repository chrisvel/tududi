'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'rate_limits', {
            key: {
                type: Sequelize.STRING(512),
                primaryKey: true,
                allowNull: false,
            },
            hits: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            reset_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await safeAddIndex(queryInterface, 'rate_limits', ['reset_at'], {
            name: 'rate_limits_reset_at',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('rate_limits');
    },
};
