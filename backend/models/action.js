const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Action = sequelize.define(
        'Action',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            actor_user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            verb: {
                type: DataTypes.STRING,
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
            target_user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            access_level: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true,
            },
        },
        {
            tableName: 'actions',
        }
    );

    return Action;
};
