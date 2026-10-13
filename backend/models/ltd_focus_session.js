'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
// Life-to-Day (T-502): one single-task Focus session (blueprint 13.3).
module.exports = (sequelize) =>
    sequelize.define(
        'LtdFocusSession',
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
            task_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'SET NULL',
            },
            started_at: { type: DataTypes.DATE, allowNull: false },
            ended_at: { type: DataTypes.DATE, allowNull: true },
            planned_minutes: { type: DataTypes.INTEGER, allowNull: false },
            actual_minutes: { type: DataTypes.INTEGER, allowNull: true },
            interrupted: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            resume_note: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            tableName: 'ltd_focus_sessions',
            timestamps: false,
            indexes: [
                { fields: ['user_id'] },
                { fields: ['task_id'] },
                { fields: ['user_id', 'task_id'] },
            ],
        }
    );
