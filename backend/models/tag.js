const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Tag = sequelize.define(
        'Tag',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
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
            tableName: 'tags',
            indexes: [
                {
                    fields: ['user_id'],
                },
            ],
        }
    );

    return Tag;
};
