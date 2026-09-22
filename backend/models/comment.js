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
            // Only one level deep: a reply's parent is always a top-level
            // comment, never another reply (enforced in the service layer).
            parent_comment_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'comments', key: 'id' },
                onDelete: 'CASCADE',
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
                {
                    fields: ['parent_comment_id'],
                    name: 'comments_parent_comment_id',
                },
            ],
        }
    );

    return Comment;
};
