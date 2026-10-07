const { DataTypes } = require('sequelize');

// Per-user position of a project on the Projects page. Kept per user so a
// shared project can sit in a different place for each member.
module.exports = (sequelize) => {
    const UserProjectOrder = sequelize.define(
        'UserProjectOrder',
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
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'projects', key: 'id' },
            },
            position: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: 'user_project_orders',
            indexes: [
                { fields: ['project_id'] },
                {
                    fields: ['user_id', 'project_id'],
                    unique: true,
                    name: 'user_project_orders_user_project_unique',
                },
            ],
        }
    );

    return UserProjectOrder;
};
