const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TaskMatrix = sequelize.define(
        'TaskMatrix',
        {
            task_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
            },
            matrix_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                references: {
                    model: 'matrices',
                    key: 'id',
                },
            },
            quadrant_index: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: 0,
                    max: 3,
                },
            },
            position: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: 0,
                },
            },
        },
        {
            tableName: 'task_matrices',
        }
    );

    return TaskMatrix;
};
