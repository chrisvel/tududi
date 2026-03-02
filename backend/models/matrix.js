const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Matrix = sequelize.define(
        'Matrix',
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
                defaultValue: () => uid(),
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [1, 255],
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
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            x_axis_label_left: {
                type: DataTypes.STRING(100),
                allowNull: false,
                defaultValue: 'Low Effort',
            },
            x_axis_label_right: {
                type: DataTypes.STRING(100),
                allowNull: false,
                defaultValue: 'High Effort',
            },
            y_axis_label_top: {
                type: DataTypes.STRING(100),
                allowNull: false,
                defaultValue: 'High Impact',
            },
            y_axis_label_bottom: {
                type: DataTypes.STRING(100),
                allowNull: false,
                defaultValue: 'Low Impact',
            },
        },
        {
            tableName: 'matrices',
        }
    );

    return Matrix;
};
