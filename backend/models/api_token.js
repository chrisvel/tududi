const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ApiToken = sequelize.define(
        'ApiToken',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            token_hash: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            token_prefix: {
                type: DataTypes.STRING(32),
                allowNull: false,
            },
            abilities: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_used_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            revoked_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'api_tokens',
            underscored: true,
        }
    );

    return ApiToken;
};
