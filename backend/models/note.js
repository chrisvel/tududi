const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Note = sequelize.define(
        'Note',
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
            title: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
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
            color: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // A content background id (see frontend/constants/contentBackgrounds).
            background: {
                type: DataTypes.STRING(40),
                allowNull: true,
            },
            // The public page shows the note's color and background.
            public_inherit_style: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            pin_to_sidebar: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            public_token: {
                type: DataTypes.STRING(64),
                allowNull: true,
            },
            public_shared_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'notes',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['project_id'],
                },
                {
                    name: 'notes_public_token_unique',
                    fields: ['public_token'],
                    unique: true,
                },
            ],
        }
    );

    // The token is the credential of the public link, so it never travels with
    // the note: anyone who can read or edit a shared note must not be able to
    // lift the link. The owner reads it from the public-share endpoint.
    Note.prototype.toJSON = function toJSON() {
        const values = this.get({ plain: true });
        if (values.public_token !== undefined) {
            // Sharing that was turned off keeps its token but not its time.
            values.is_public =
                values.public_shared_at === undefined
                    ? Boolean(values.public_token)
                    : Boolean(values.public_token && values.public_shared_at);
            delete values.public_token;
        }
        return values;
    };

    return Note;
};
