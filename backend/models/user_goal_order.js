const { DataTypes } = require('sequelize');

// Per-user position of a goal on the Goals page. Kept per user so a shared
// goal can sit in a different place for each member.
module.exports = (sequelize) => {
    const UserGoalOrder = sequelize.define(
        'UserGoalOrder',
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
            goal_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'goals', key: 'id' },
            },
            position: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: 'user_goal_orders',
            indexes: [
                { fields: ['goal_id'] },
                {
                    fields: ['user_id', 'goal_id'],
                    unique: true,
                    name: 'user_goal_orders_user_goal_unique',
                },
            ],
        }
    );

    return UserGoalOrder;
};
