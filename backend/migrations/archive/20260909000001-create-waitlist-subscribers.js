'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'waitlist_subscribers', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            email: {
                type: Sequelize.STRING(254),
                allowNull: false,
                unique: true,
            },
            source: {
                type: Sequelize.STRING(32),
                allowNull: false,
                defaultValue: 'unknown',
            },
            locale: { type: Sequelize.STRING(8), allowNull: true },
            referrer: { type: Sequelize.STRING(512), allowNull: true },
            submission_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });
        await safeAddIndex(queryInterface, 'waitlist_subscribers', [
            'created_at',
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('waitlist_subscribers');
    },
};
