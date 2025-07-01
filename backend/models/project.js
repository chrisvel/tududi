const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Project = sequelize.define(
        'Project',
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
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            pin_to_sidebar: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: true,
                validate: {
                    min: 0,
                    max: 2,
                },
            },
            due_date_at: {
                type: DataTypes.DATE,
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
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'areas',
                    key: 'id',
                },
            },
            image_url: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'projects',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['area_id'],
                },
            ],
        }
    );

    return Project;
};
