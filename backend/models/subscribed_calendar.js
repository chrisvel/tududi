const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const SubscribedCalendar = sequelize.define(
        'SubscribedCalendar',
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
            url: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: 'URL is required',
                    },
                },
            },
            color: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '#6b7280',
            },
            last_error: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'subscribed_calendars',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            indexes: [{ fields: ['user_id'] }],
        }
    );

    SubscribedCalendar.associate = function (models) {
        SubscribedCalendar.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user',
        });
    };

    return SubscribedCalendar;
};
