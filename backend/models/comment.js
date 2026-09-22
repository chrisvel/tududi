const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Comment = sequelize.define(
        'Comment',
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
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            body: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            mentioned_person_uids: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: [],
            },
            deleted_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'comments',
            indexes: [
                { fields: ['task_id'], name: 'comments_task_id' },
                { fields: ['user_id'], name: 'comments_user_id' },
                {
                    fields: ['task_id', 'created_at'],
                    name: 'comments_task_id_created_at',
                },
            ],
        }
    );

    return Comment;
};
