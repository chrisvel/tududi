const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CalendarToken = sequelize.define(
    'CalendarToken',
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
                model: 'Users',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        provider: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'google',
        },
        access_token: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        refresh_token: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        token_type: {
            type: DataTypes.STRING,
            defaultValue: 'Bearer',
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        scope: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        connected_email: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: 'calendar_tokens',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'provider'],
            },
        ],
    }
);

// Associations
CalendarToken.associate = function (models) {
    CalendarToken.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
    });
};

module.exports = CalendarToken;
