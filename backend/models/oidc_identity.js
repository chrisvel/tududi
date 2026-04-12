const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OIDCIdentity = sequelize.define(
        'OIDCIdentity',
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
            provider_slug: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            subject: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            given_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            family_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            picture: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            raw_claims: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            first_login_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_login_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'oidc_identities',
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['provider_slug', 'subject'],
                },
            ],
        }
    );

    return OIDCIdentity;
};
