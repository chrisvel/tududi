'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
module.exports = (sequelize) =>
    sequelize.define(
        'LtdMetricCheckin',
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
            metric_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'ltd_goal_metrics', key: 'id' },
                onDelete: 'CASCADE',
            },
            value: { type: DataTypes.DOUBLE, allowNull: false },
            recorded_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            note: { type: DataTypes.TEXT, allowNull: true },
            source: {
                type: DataTypes.ENUM('user', 'ai', 'mcp', 'habit'),
                allowNull: false,
                defaultValue: 'user',
            },
        },
        {
            tableName: 'ltd_metric_checkins',
            timestamps: false,
            indexes: [{ fields: ['metric_id'] }],
        }
    );
