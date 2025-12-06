const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const TaskAttachment = sequelize.define(
        'TaskAttachment',
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
            task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
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
            original_filename: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            stored_filename: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_size: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            mime_type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_path: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            tableName: 'task_attachments',
            indexes: [
                {
                    fields: ['task_id'],
                },
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['uid'],
                    unique: true,
                },
            ],
        }
    );

    // Define associations
    TaskAttachment.associate = function (models) {
        TaskAttachment.belongsTo(models.Task, {
            foreignKey: 'task_id',
            as: 'Task',
        });

        TaskAttachment.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    return TaskAttachment;
};
