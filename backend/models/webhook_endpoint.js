const { DataTypes } = require('sequelize');
const { randomUUID } = require('crypto');

module.exports = (sequelize) => {
    const WebhookEndpoint = sequelize.define(
        'WebhookEndpoint',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: false,
                defaultValue: () => randomUUID(),
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
            },
            url: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isUrl: {
                        protocols: ['http', 'https'],
                        require_protocol: true,
                    },
                },
            },
            secret: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            event_types: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: [],
                validate: {
                    isValidEventTypes(value) {
                        if (!Array.isArray(value)) {
                            throw new Error('event_types must be an array');
                        }
                    },
                },
            },
            active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            last_delivery_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_delivery_status: {
                type: DataTypes.STRING(16),
                allowNull: true,
                validate: {
                    isIn: [[null, 'success', 'failed']],
                },
            },
            last_delivery_error: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            failure_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            auth_type: {
                type: DataTypes.STRING(16),
                allowNull: false,
                defaultValue: 'none',
                validate: {
                    isIn: [['none', 'basic', 'header']],
                },
            },
            auth_header_name: {
                type: DataTypes.STRING(128),
                allowNull: true,
            },
            auth_username: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            auth_secret: {
                type: DataTypes.STRING(500),
                allowNull: true,
            },
        },
        {
            tableName: 'webhook_endpoints',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [{ fields: ['user_id'] }],
        }
    );

    WebhookEndpoint.associate = function (models) {
        WebhookEndpoint.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    // An endpoint matches a notification type when it has no explicit
    // filter (subscribed to everything) or lists the type explicitly.
    WebhookEndpoint.prototype.matchesType = function (type) {
        return (
            !Array.isArray(this.event_types) ||
            this.event_types.length === 0 ||
            this.event_types.includes(type)
        );
    };

    return WebhookEndpoint;
};
