const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Note = sequelize.define(
        'Note',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            content: {
                type: DataTypes.TEXT,
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
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'projects',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'notes',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['project_id'],
                },
            ],
        }
    );

    return Note;
};
