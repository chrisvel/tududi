const { DataTypes } = require('sequelize');

// Per-user position of an area on the Areas page. Kept per user so a shared
// area can sit in a different place for each member.
module.exports = (sequelize) => {
    const UserAreaOrder = sequelize.define(
        'UserAreaOrder',
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
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'areas', key: 'id' },
            },
            position: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: 'user_area_orders',
            indexes: [
                { fields: ['area_id'] },
                {
                    fields: ['user_id', 'area_id'],
                    unique: true,
                    name: 'user_area_orders_user_area_unique',
                },
            ],
        }
    );

    return UserAreaOrder;
};
