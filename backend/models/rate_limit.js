const { DataTypes } = require('sequelize');

// Hit counters for express-rate-limit when several app processes share one
// PostgreSQL database. Rows expire at reset_at and are swept by the daily
// cleanup job.
module.exports = (sequelize) => {
    const RateLimit = sequelize.define(
        'RateLimit',
        {
            key: {
                type: DataTypes.STRING(512),
                primaryKey: true,
                allowNull: false,
            },
            hits: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            reset_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        {
            tableName: 'rate_limits',
            timestamps: true,
            underscored: true,
            indexes: [{ fields: ['reset_at'] }],
        }
    );

    return RateLimit;
};
