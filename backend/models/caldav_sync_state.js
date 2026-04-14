const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CalDAVSyncState = sequelize.define(
        'CalDAVSyncState',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            task_id: {
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
            etag: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            last_modified: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            last_synced_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            sync_status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'synced',
                validate: {
                    isIn: {
                        args: [['synced', 'pending', 'conflict', 'error']],
                        msg: 'Sync status must be synced, pending, conflict, or error',
                    },
                },
            },
            conflict_local_version: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            conflict_remote_version: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            conflict_detected_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'caldav_sync_state',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            indexes: [
                {
                    fields: ['task_id'],
                },
                {
                    fields: ['calendar_id'],
                },
                {
                    fields: ['etag'],
                },
                {
                    fields: ['sync_status'],
                },
                {
                    fields: ['task_id', 'calendar_id'],
                    unique: true,
                },
            ],
        }
    );

    CalDAVSyncState.associate = function (models) {
        CalDAVSyncState.belongsTo(models.Task, {
            foreignKey: 'task_id',
            as: 'task',
        });

        CalDAVSyncState.belongsTo(models.CalDAVCalendar, {
            foreignKey: 'calendar_id',
            as: 'calendar',
        });
    };

    return CalDAVSyncState;
};
