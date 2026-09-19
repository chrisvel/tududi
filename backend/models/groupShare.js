const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const GroupShare = sequelize.define(
        'GroupShare',
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
            resource_type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            resource_uid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            access_level: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            granted_by_user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
        },
        {
            tableName: 'group_shares',
            indexes: [
                {
                    unique: true,
                    fields: ['group_id', 'resource_type', 'resource_uid'],
                    name: 'group_shares_group_resource',
                },
                {
                    fields: ['resource_type', 'resource_uid'],
                    name: 'group_shares_resource',
                },
            ],
        }
    );

    return GroupShare;
};
