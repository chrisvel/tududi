'use strict';
const { DataTypes } = require('sequelize');
// Life-to-Day (T-706): per-user MCP controls (blueprint 17.6): read-only
// mode, the kill switch time, and per-client state such as writes_disabled.
module.exports = (sequelize) =>
    sequelize.define(
        'LtdMcpSetting',
        {
            user_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            read_only: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            tokens_revoked_at: { type: DataTypes.DATE, allowNull: true },
            clients: { type: DataTypes.JSON, allowNull: true },
        },
        {
            tableName: 'ltd_mcp_settings',
            createdAt: false,
            updatedAt: 'updated_at',
        }
    );
