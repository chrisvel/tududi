const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
    sequelize.define(
        'CaptureReceipt',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            request_key: { type: DataTypes.STRING(64), allowNull: false },
            fingerprint: { type: DataTypes.STRING(64), allowNull: false },
            result: { type: DataTypes.JSON, allowNull: true },
        },
        {
            tableName: 'capture_receipts',
            indexes: [
                {
                    name: 'capture_receipts_user_request',
                    unique: true,
                    fields: ['user_id', 'request_key'],
                },
            ],
        }
    );
