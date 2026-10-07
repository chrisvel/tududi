const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserGroupMember = sequelize.define(
        'UserGroupMember',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            group_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'user_groups', key: 'id' },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            added_by_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            },
        },
        {
            tableName: 'user_group_members',
            indexes: [
                {
                    unique: true,
                    fields: ['group_id', 'user_id'],
                    name: 'user_group_members_group_user',
                },
                { fields: ['user_id'], name: 'user_group_members_user_id' },
            ],
        }
    );

    return UserGroupMember;
};
