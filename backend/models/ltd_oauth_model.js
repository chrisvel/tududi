'use strict';
const { DataTypes } = require('sequelize');
// Life-to-Day (T-701): storage for the embedded OAuth server (oidc-provider
// adapter). One row per stored model instance, keyed "<Model>:<id>".
module.exports = (sequelize) =>
    sequelize.define(
        'LtdOauthModel',
        {
            key: { type: DataTypes.STRING, primaryKey: true },
            model: { type: DataTypes.STRING, allowNull: false },
            payload: { type: DataTypes.JSON, allowNull: false },
            grant_id: { type: DataTypes.STRING, allowNull: true },
            uid: { type: DataTypes.STRING, allowNull: true },
            account_id: { type: DataTypes.STRING, allowNull: true },
            client_id: { type: DataTypes.STRING, allowNull: true },
            expires_at: { type: DataTypes.DATE, allowNull: true },
            consumed_at: { type: DataTypes.DATE, allowNull: true },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: 'ltd_oauth_models',
            timestamps: false,
            indexes: [
                { fields: ['grant_id'] },
                { fields: ['uid'] },
                { fields: ['account_id', 'model'] },
            ],
        }
    );
