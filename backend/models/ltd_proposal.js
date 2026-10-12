'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
// Life-to-Day (T-704): a pending change from MCP or AI (blueprint 13.3).
// Nothing in `ops` touches domain data until the user applies it in the app.
module.exports = (sequelize) =>
    sequelize.define(
        'LtdProposal',
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
                onDelete: 'CASCADE',
            },
            origin: {
                type: DataTypes.ENUM('in_app_ai', 'mcp', 'rule'),
                allowNull: false,
            },
            client_id: { type: DataTypes.STRING, allowNull: true },
            title: { type: DataTypes.STRING, allowNull: false },
            rationale: { type: DataTypes.TEXT, allowNull: true },
            ops: { type: DataTypes.JSON, allowNull: false },
            risk_tier: {
                type: DataTypes.ENUM('R0', 'R1', 'R2', 'R3'),
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM(
                    'pending',
                    'applied',
                    'partially_applied',
                    'rejected',
                    'expired',
                    'reverted'
                ),
                allowNull: false,
                defaultValue: 'pending',
            },
            expires_at: { type: DataTypes.DATE, allowNull: false },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            decided_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: 'ltd_proposals',
            timestamps: false,
            indexes: [{ fields: ['user_id', 'status'] }],
        }
    );
