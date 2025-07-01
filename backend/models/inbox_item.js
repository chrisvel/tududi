const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InboxItem = sequelize.define(
        'InboxItem',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            content: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'added',
            },
            source: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'inbox_items',
            indexes: [
                {
                    fields: ['user_id'],
                },
            ],
        }
    );

    return InboxItem;
};
