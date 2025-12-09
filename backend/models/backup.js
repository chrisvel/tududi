const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Backup = sequelize.define(
        'Backup',
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
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            file_path: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Path to the backup file on disk',
            },
            file_size: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: 'Size of backup file in bytes',
            },
            item_counts: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: 'JSON object with counts of backed up items',
            },
            version: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '1.0',
            },
        },
        {
            tableName: 'backups',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['created_at'],
                },
            ],
        }
    );

    return Backup;
};
