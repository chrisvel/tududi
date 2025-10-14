const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Permission = sequelize.define(
        'Permission',
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
            },
            source_action_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            tableName: 'permissions',
            indexes: [
                { fields: ['user_id'] },
                { fields: ['resource_type', 'resource_uid'] },
                { fields: ['access_level'] },
            ],
        }
    );

    return Permission;
};
