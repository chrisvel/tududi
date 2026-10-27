const { DataTypes } = require('sequelize');

// A user's authenticator secret, once two-factor sign-in is on. The secret is
// encrypted with shared/crypto/secretCipher. `last_used_step` is the 30-second
// step of the last accepted code, so the same code is never taken twice.
module.exports = (sequelize) => {
    const UserMfa = sequelize.define(
        'UserMfa',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: 'users', key: 'id' },
            },
            secret_encrypted: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            last_used_step: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            enabled_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        {
            tableName: 'user_mfa',
        }
    );

    return UserMfa;
};
