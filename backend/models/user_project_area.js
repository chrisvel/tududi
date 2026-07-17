const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserProjectArea = sequelize.define(
        'UserProjectArea',
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
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'projects', key: 'id' },
            },
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'areas', key: 'id' },
            },
        },
        {
            tableName: 'user_project_areas',
            indexes: [
                { fields: ['user_id'] },
                { fields: ['project_id'] },
                {
                    fields: ['user_id', 'project_id'],
                    unique: true,
                    name: 'user_project_areas_user_project_unique',
                },
            ],
        }
    );

    return UserProjectArea;
};
