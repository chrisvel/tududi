const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

// Parses a TEXT column holding JSON. Stored as TEXT so the value reads back
// exactly as written.
function jsonText(field) {
    return {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const raw = this.getDataValue(field);
            if (raw === null || raw === undefined) return null;
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        },
        set(value) {
            this.setDataValue(
                field,
                value === null || value === undefined
                    ? null
                    : JSON.stringify(value)
            );
        },
    };
}

// One spreadsheet import. While `status` is 'parsed', `sheets` holds the
// uploaded file as rows of strings; once committed it is dropped and `result`
// keeps what was created and what updated rows looked like before, which is
// all an undo needs.
module.exports = (sequelize) => {
    const ImportJob = sequelize.define(
        'ImportJob',
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
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            file_name: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            status: {
                type: DataTypes.STRING(16),
                allowNull: false,
                defaultValue: 'parsed',
            },
            sheets: jsonText('sheets'),
            options: jsonText('options'),
            result: jsonText('result'),
            committed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            undone_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'import_jobs',
            indexes: [
                {
                    fields: ['user_id', 'created_at'],
                    name: 'import_jobs_user_created',
                },
            ],
        }
    );

    return ImportJob;
};
