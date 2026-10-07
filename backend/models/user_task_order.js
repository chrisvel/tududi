const { DataTypes } = require('sequelize');

// Per-user manual position of a task in one list. `scope` names the list:
// 'all' for the All Tasks page, 'project:<project id>' for a project's tasks.
module.exports = (sequelize) => {
    const UserTaskOrder = sequelize.define(
        'UserTaskOrder',
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
            task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
            },
            scope: {
                type: DataTypes.STRING(64),
                allowNull: false,
            },
            position: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: 'user_task_orders',
            indexes: [
                { fields: ['task_id'] },
                {
                    fields: ['user_id', 'scope', 'task_id'],
                    unique: true,
                    name: 'user_task_orders_user_scope_task_unique',
                },
            ],
        }
    );

    return UserTaskOrder;
};
