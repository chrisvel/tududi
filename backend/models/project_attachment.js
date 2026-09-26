const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const ProjectAttachment = sequelize.define(
        'ProjectAttachment',
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
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
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
            tableName: 'project_attachments',
            indexes: [
                {
                    fields: ['project_id'],
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

    return ProjectAttachment;
};
