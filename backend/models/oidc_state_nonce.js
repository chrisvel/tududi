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
            // SHA-256 of a random cookie value set in the browser that started
            // the flow. The callback must present the same cookie, so a
            // callback URL captured by someone else is useless in another
            // browser.
            binding_hash: {
                type: DataTypes.STRING(64),
                allowNull: true,
            },
            // The signed-in user who started an account-link flow.
            user_id: {
                type: DataTypes.INTEGER,
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
