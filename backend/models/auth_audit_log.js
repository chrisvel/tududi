const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AuthAuditLog = sequelize.define(
        'AuthAuditLog',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            event_type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            auth_method: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            provider_slug: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ip_address: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            user_agent: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true,
            },
        },
        {
            tableName: 'auth_audit_log',
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: false,
        }
    );

    return AuthAuditLog;
};
