const { DataTypes } = require('sequelize');

// A single-use code that signs in in place of an authenticator code. Only a
// bcrypt hash is kept; `used_at` is set when it is spent.
module.exports = (sequelize) => {
    const UserRecoveryCode = sequelize.define(
        'UserRecoveryCode',
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
            },
            code_hash: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            used_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'user_recovery_codes',
            updatedAt: false,
            indexes: [
                { fields: ['user_id'], name: 'user_recovery_codes_user' },
            ],
        }
    );

    return UserRecoveryCode;
};
