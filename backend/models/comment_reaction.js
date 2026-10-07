const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CommentReaction = sequelize.define(
        'CommentReaction',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            comment_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'comments', key: 'id' },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            reaction_type: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isIn: [['like', 'dislike']],
                },
            },
        },
        {
            tableName: 'comment_reactions',
            indexes: [
                {
                    unique: true,
                    fields: ['comment_id', 'user_id'],
                    name: 'comment_reactions_comment_id_user_id',
                },
                {
                    fields: ['comment_id'],
                    name: 'comment_reactions_comment_id',
                },
            ],
        }
    );

    return CommentReaction;
};
