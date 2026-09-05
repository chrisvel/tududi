const { DataTypes } = require('sequelize');

// Counters for rate-type limits (AI requests per day). Stock limits such
// as task counts are counted live; only metrics with no row to count need
// a counter.
module.exports = (sequelize) => {
    const UsageCounter = sequelize.define(
        'UsageCounter',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            metric: {
                type: DataTypes.STRING(32),
                allowNull: false,
            },
            period_key: {
                type: DataTypes.STRING(16),
                allowNull: false,
            },
            count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
        },
        {
            tableName: 'usage_counters',
            indexes: [
                {
                    unique: true,
                    fields: ['user_id', 'metric', 'period_key'],
                    name: 'usage_counters_user_metric_period',
                },
            ],
        }
    );

    return UsageCounter;
};
