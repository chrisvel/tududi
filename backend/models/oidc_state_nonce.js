const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OIDCStateNonce = sequelize.define(
        'OIDCStateNonce',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            state: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            nonce: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            provider_slug: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            code_verifier: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            redirect_uri: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        {
            tableName: 'oidc_state_nonces',
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: false,
        }
    );

    return OIDCStateNonce;
};
