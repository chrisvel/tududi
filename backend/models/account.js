const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

// A customer's account on a hosted instance: the person who signed up and
// pays (the owner) plus the members added to it. Admins of the account manage
// its members and groups and never see another account's. Self-hosted
// instances leave this table empty.
module.exports = (sequelize) => {
    const Account = sequelize.define(
        'Account',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING(15),
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            owner_user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },
        },
        {
            tableName: 'accounts',
        }
    );

    return Account;
};
