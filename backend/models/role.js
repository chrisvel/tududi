const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Role = sequelize.define(
        'Role',
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
            },
            is_admin: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            role: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'user',
            },
            capabilities: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null,
            },
        },
        {
            tableName: 'roles',
        }
    );

    return Role;
};
