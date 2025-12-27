const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PushSubscription = sequelize.define(
        'PushSubscription',
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
            endpoint: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            keys: {
                type: DataTypes.JSON,
                allowNull: false,
            },
        },
        {
            tableName: 'push_subscriptions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['user_id'] },
                { fields: ['endpoint'], unique: true },
            ],
        }
    );

    return PushSubscription;
};

