const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const CalDAVCalendar = sequelize.define(
        'CalDAVCalendar',
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
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: 'Calendar name is required',
                    },
                },
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            color: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ctag: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            sync_token: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            sync_direction: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'bidirectional',
                validate: {
                    isIn: {
                        args: [['bidirectional', 'pull_only', 'push_only']],
                        msg: 'Sync direction must be bidirectional, pull_only, or push_only',
                    },
                },
            },
            sync_interval_minutes: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 15,
                validate: {
                    min: {
                        args: [5],
                        msg: 'Sync interval must be at least 5 minutes',
                    },
                },
            },
            last_sync_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_sync_status: {
                type: DataTypes.STRING,
                allowNull: true,
                validate: {
                    isIn: {
                        args: [['success', 'error', 'conflict']],
                        msg: 'Sync status must be success, error, or conflict',
                    },
                },
            },
            conflict_resolution: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'last_write_wins',
                validate: {
                    isIn: {
                        args: [
                            [
                                'last_write_wins',
                                'local_wins',
                                'remote_wins',
                                'manual',
                            ],
                        ],
                        msg: 'Conflict resolution must be last_write_wins, local_wins, remote_wins, or manual',
                    },
                },
            },
        },
        {
            tableName: 'caldav_calendars',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['uid'],
                    unique: true,
                },
                {
                    fields: ['enabled'],
                },
            ],
        }
    );

    CalDAVCalendar.associate = function (models) {
        CalDAVCalendar.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user',
        });

        CalDAVCalendar.hasMany(models.CalDAVSyncState, {
            foreignKey: 'calendar_id',
            as: 'syncStates',
        });

        CalDAVCalendar.hasMany(models.CalDAVOccurrenceOverride, {
            foreignKey: 'calendar_id',
            as: 'occurrenceOverrides',
        });

        CalDAVCalendar.hasOne(models.CalDAVRemoteCalendar, {
            foreignKey: 'local_calendar_id',
            as: 'remoteCalendar',
        });
    };

    return CalDAVCalendar;
};
