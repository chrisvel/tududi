const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const InboxItem = sequelize.define(
        'InboxItem',
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
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            title: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'added',
            },
            source: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            suggested_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            suggested_reason: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            parsed_tags: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            parsed_projects: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            cleaned_content: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            // Last AI assist result ({ item_uid, options, generated_at }).
            ai_suggestion: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            // sha256 of the text and file names the suggestion was made from.
            ai_suggestion_key: {
                type: DataTypes.STRING(64),
                allowNull: true,
            },
        },
        {
            tableName: 'inbox_items',
            indexes: [
                {
                    fields: ['user_id'],
                },
            ],
        }
    );

    return InboxItem;
};
