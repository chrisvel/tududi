const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const CalendarFeed = sequelize.define(
        'CalendarFeed',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // A secret iCal address grants read access to the calendar, so it
            // is encrypted at rest and never returned by the API.
            url_encrypted: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            url_host: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            color: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            last_fetched_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_error: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            show_on_calendar: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            tableName: 'calendar_feeds',
            indexes: [{ fields: ['user_id'], name: 'calendar_feeds_user_id' }],
        }
    );

    return CalendarFeed;
};
