'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
// Life-to-Day (T-601): a life event or goal milestone on the Life timeline
// (blueprint 13.3). `date` is an ISO Gregorian day; Jalali is display-only.
module.exports = (sequelize) =>
    sequelize.define(
        'LtdMilestone',
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
            title: { type: DataTypes.STRING, allowNull: false },
            date: { type: DataTypes.DATEONLY, allowNull: false },
            date_precision: {
                type: DataTypes.ENUM('day', 'month', 'year'),
                allowNull: false,
                defaultValue: 'day',
            },
            kind: {
                type: DataTypes.ENUM('life_event', 'goal_milestone'),
                allowNull: false,
                defaultValue: 'life_event',
            },
            goal_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'goals', key: 'id' },
                onDelete: 'SET NULL',
            },
            note: { type: DataTypes.TEXT, allowNull: true },
            color: { type: DataTypes.STRING, allowNull: true },
        },
        {
            tableName: 'ltd_milestones',
            indexes: [{ fields: ['user_id', 'date'] }, { fields: ['goal_id'] }],
        }
    );
