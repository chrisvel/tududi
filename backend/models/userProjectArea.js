const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserProjectArea = sequelize.define(
        'UserProjectArea',
        {
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                references: {
                    model: 'projects',
                    key: 'id',
                },
            },
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'areas',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'user_project_areas',
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['user_id', 'project_id'],
                },
                {
                    fields: ['project_id'],
                },
                {
                    fields: ['area_id'],
                },
                {
                    fields: ['user_id', 'area_id'],
                },
            ],
        }
    );

    return UserProjectArea;
};
