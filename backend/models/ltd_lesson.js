'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
// Life-to-Day (T-1102): a life lesson (blueprint 13.3, 14.7). Days are ISO
// Gregorian; Jalali is display-only. if_text and then_text are both set or
// both empty, a service rule.
module.exports = (sequelize) =>
    sequelize.define(
        'LtdLesson',
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
            expected: { type: DataTypes.TEXT, allowNull: true },
            happened: { type: DataTypes.TEXT, allowNull: true },
            if_text: { type: DataTypes.TEXT, allowNull: true },
            then_text: { type: DataTypes.TEXT, allowNull: true },
            learned_on: { type: DataTypes.DATEONLY, allowNull: false },
            source_type: {
                type: DataTypes.ENUM('free', 'milestone', 'task', 'goal'),
                allowNull: true,
            },
            source_uid: { type: DataTypes.STRING, allowNull: true },
            status: {
                type: DataTypes.ENUM('active', 'parked', 'retired'),
                allowNull: false,
                defaultValue: 'active',
            },
            review_on: { type: DataTypes.DATEONLY, allowNull: true },
        },
        {
            tableName: 'ltd_lessons',
            indexes: [
                { fields: ['user_id', 'status'] },
                { fields: ['user_id', 'review_on'] },
            ],
        }
    );
