'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
module.exports = (sequelize) =>
    sequelize.define(
        'LtdGoalMetric',
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
            goal_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'goals', key: 'id' },
                onDelete: 'CASCADE',
            },
            name: { type: DataTypes.STRING, allowNull: false },
            unit: { type: DataTypes.STRING, allowNull: true },
            baseline: { type: DataTypes.DOUBLE, allowNull: false },
            target: { type: DataTypes.DOUBLE, allowNull: false },
            direction: {
                type: DataTypes.ENUM('increase', 'decrease'),
                allowNull: false,
                defaultValue: 'increase',
            },
            current_value: { type: DataTypes.DOUBLE, allowNull: false },
            weight: {
                type: DataTypes.DOUBLE,
                allowNull: false,
                defaultValue: 1,
            },
            source: {
                type: DataTypes.ENUM('manual', 'habit', 'task_count'),
                allowNull: false,
                defaultValue: 'manual',
            },
        },
        { tableName: 'ltd_goal_metrics', indexes: [{ fields: ['goal_id'] }] }
    );
