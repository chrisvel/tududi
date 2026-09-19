const { DataTypes } = require('sequelize');

// Per-member access rows produced by a group grant. Same meaning as a
// Permission row, kept in its own table so a user can hold a direct share and
// one or more group grants on the same resource without the sources
// overwriting each other. Read them through services/permissionSources.js.
module.exports = (sequelize) => {
    const GroupPermission = sequelize.define(
        'GroupPermission',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            group_share_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'group_shares', key: 'id' },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
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
            propagation: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'direct',
            },
            granted_by_user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'accepted',
                validate: {
                    isIn: [['pending', 'accepted']],
                },
            },
        },
        {
            tableName: 'group_permissions',
            indexes: [
                {
                    unique: true,
                    fields: [
                        'group_share_id',
                        'user_id',
                        'resource_type',
                        'resource_uid',
                    ],
                    name: 'group_permissions_share_user_resource',
                },
                { fields: ['user_id'], name: 'group_permissions_user_id' },
                {
                    fields: ['resource_type', 'resource_uid'],
                    name: 'group_permissions_resource',
                },
                {
                    fields: ['user_id', 'status'],
                    name: 'group_permissions_user_status',
                },
            ],
        }
    );

    return GroupPermission;
};
