const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CalDAVOccurrenceOverride = sequelize.define(
        'CalDAVOccurrenceOverride',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            parent_task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
            },
            calendar_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'caldav_calendars',
                    key: 'id',
                },
            },
            recurrence_id: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            override_name: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            override_due_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            override_status: {
                type: DataTypes.INTEGER,
                allowNull: true,
                validate: {
                    min: 0,
                    max: 6,
                },
            },
            override_priority: {
                type: DataTypes.INTEGER,
                allowNull: true,
                validate: {
                    min: 0,
                    max: 2,
                },
            },
            override_note: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'caldav_occurrence_overrides',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            indexes: [
                {
                    fields: ['parent_task_id'],
                },
                {
                    fields: ['calendar_id'],
                },
                {
                    fields: ['recurrence_id'],
                },
                {
                    fields: ['parent_task_id', 'calendar_id', 'recurrence_id'],
                    unique: true,
                },
            ],
        }
    );

    CalDAVOccurrenceOverride.associate = function (models) {
        CalDAVOccurrenceOverride.belongsTo(models.Task, {
            foreignKey: 'parent_task_id',
            as: 'parentTask',
        });

        CalDAVOccurrenceOverride.belongsTo(models.CalDAVCalendar, {
            foreignKey: 'calendar_id',
            as: 'calendar',
        });
    };

    return CalDAVOccurrenceOverride;
};
