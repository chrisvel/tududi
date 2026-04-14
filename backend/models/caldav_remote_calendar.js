const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CalDAVRemoteCalendar = sequelize.define(
        'CalDAVRemoteCalendar',
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
            local_calendar_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'caldav_calendars',
                    key: 'id',
                },
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: 'Remote calendar name is required',
                    },
                },
            },
            server_url: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isUrl: {
                        msg: 'Server URL must be a valid URL',
                    },
                },
            },
            calendar_path: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            username: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: 'Username is required',
                    },
                },
            },
            password_encrypted: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            auth_type: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'basic',
                validate: {
                    isIn: {
                        args: [['basic', 'digest', 'bearer']],
                        msg: 'Auth type must be basic, digest, or bearer',
                    },
                },
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
            last_sync_error: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            server_ctag: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            server_sync_token: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: 'caldav_remote_calendars',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['local_calendar_id'],
                },
                {
                    fields: ['enabled'],
                },
            ],
        }
    );

    CalDAVRemoteCalendar.associate = function (models) {
        CalDAVRemoteCalendar.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user',
        });

        CalDAVRemoteCalendar.belongsTo(models.CalDAVCalendar, {
            foreignKey: 'local_calendar_id',
            as: 'localCalendar',
        });
    };

    return CalDAVRemoteCalendar;
};
