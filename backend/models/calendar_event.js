const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CalendarEvent = sequelize.define(
        'CalendarEvent',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            source: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            ical_uid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            starts_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            ends_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            all_day: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            location: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'calendar_events',
            indexes: [
                {
                    unique: true,
                    fields: ['user_id', 'source', 'ical_uid', 'starts_at'],
                    name: 'calendar_events_unique_event',
                },
                {
                    fields: ['user_id', 'starts_at'],
                    name: 'calendar_events_user_starts_at_idx',
                },
            ],
        }
    );

    CalendarEvent.associate = function (models) {
        CalendarEvent.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    return CalendarEvent;
};
