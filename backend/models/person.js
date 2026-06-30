const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Person = sequelize.define(
        'Person',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            relationship_type: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: 'other',
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            phone: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            archived: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            color: {
                type: DataTypes.STRING(20),
                allowNull: true,
            },
        },
        {
            tableName: 'people',
            indexes: [
                { fields: ['user_id', 'archived'] },
                { fields: ['user_id', 'name'], unique: true },
            ],
        }
    );

    return Person;
};
