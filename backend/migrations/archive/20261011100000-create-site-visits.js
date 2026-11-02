'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// One row per page the admin dashboard counts as a visit: a marketing page,
// a blog page or an app load. No address is stored, only a hash that
// changes every day. Purely additive: no existing table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'site_visits', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            surface: {
                type: Sequelize.STRING(16),
                allowNull: false,
            },
            path: {
                type: Sequelize.STRING(128),
                allowNull: false,
            },
            referrer_host: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            visitor_hash: {
                type: Sequelize.STRING(32),
                allowNull: false,
            },
            // UTC day, YYYY-MM-DD, so the dashboard groups by day the same
            // way on SQLite and PostgreSQL.
            day: {
                type: Sequelize.STRING(10),
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await addIndexOnce(queryInterface, 'site_visits', ['day', 'surface'], {
            name: 'site_visits_day_surface',
        });
        await addIndexOnce(
            queryInterface,
            'site_visits',
            ['surface', 'user_id', 'day'],
            { name: 'site_visits_surface_user_day' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('site_visits');
    },
};
