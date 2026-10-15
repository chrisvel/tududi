const { DataTypes } = require('sequelize');

// A page the admin dashboard counts as a visit. `surface` says which door it
// came through: the marketing page, the blog, or the app itself. Written by
// the visit tracker alone and read only by the admin dashboard.
//
// No address or user agent is kept. `visitor_hash` changes every day, so it
// can tell two page views of one day apart from two people, but never links
// a visitor from one day to the next.
module.exports = (sequelize) => {
    const SiteVisit = sequelize.define(
        'SiteVisit',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            surface: {
                type: DataTypes.STRING(16),
                allowNull: false,
            },
            path: {
                type: DataTypes.STRING(128),
                allowNull: false,
            },
            referrer_host: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            visitor_hash: {
                type: DataTypes.STRING(32),
                allowNull: false,
            },
            // UTC day, YYYY-MM-DD.
            day: {
                type: DataTypes.STRING(10),
                allowNull: false,
            },
            // Only set on app loads by a signed-in account.
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
            },
        },
        {
            tableName: 'site_visits',
            updatedAt: false,
            indexes: [
                { fields: ['day', 'surface'], name: 'site_visits_day_surface' },
                {
                    fields: ['surface', 'user_id', 'day'],
                    name: 'site_visits_surface_user_day',
                },
            ],
        }
    );

    return SiteVisit;
};
