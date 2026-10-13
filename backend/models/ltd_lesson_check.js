'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
// Life-to-Day (T-1102): one review answer for a lesson (blueprint 13.3).
module.exports = (sequelize) =>
    sequelize.define(
        'LtdLessonCheck',
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
            lesson_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'ltd_lessons', key: 'id' },
                onDelete: 'CASCADE',
            },
            checked_on: { type: DataTypes.DATEONLY, allowNull: false },
            verdict: {
                type: DataTypes.ENUM('holds', 'not_yet', 'park'),
                allowNull: false,
            },
            note: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            tableName: 'ltd_lesson_checks',
            updatedAt: false,
            indexes: [{ fields: ['lesson_id'] }],
        }
    );
