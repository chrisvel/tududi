const { DataTypes } = require('sequelize');
const { nanoid } = require('nanoid/non-secure');

module.exports = (sequelize) => {
    const Area = sequelize.define(
        'Area',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            nanoid: {
                type: DataTypes.STRING(21),
                allowNull: false,
                unique: true,
                defaultValue: () => nanoid(),
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.STRING,
                allowNull: true,
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
            tableName: 'areas',
            indexes: [
                {
                    fields: ['user_id'],
                },
            ],
        }
    );

    return Area;
};
