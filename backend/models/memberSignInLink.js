const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const MemberSignInLink = sequelize.define(
        'MemberSignInLink',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            token_hash: {
                type: DataTypes.STRING(64),
                allowNull: false,
                unique: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            used_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            created_by_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            },
        },
        {
            tableName: 'member_sign_in_links',
            indexes: [
                {
                    unique: true,
                    fields: ['user_id'],
                    name: 'member_sign_in_links_user_id',
                },
                {
                    fields: ['created_by_user_id'],
                    name: 'member_sign_in_links_created_by_user_id',
                },
            ],
        }
    );

    return MemberSignInLink;
};
