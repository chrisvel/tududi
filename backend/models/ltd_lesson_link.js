'use strict';
const { DataTypes } = require('sequelize');
// Life-to-Day (T-1102): one target per row, a goal, project, area or tag of
// the lesson's owner (blueprint 13.3). The target is checked by the service.
module.exports = (sequelize) =>
    sequelize.define(
        'LtdLessonLink',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            lesson_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'ltd_lessons', key: 'id' },
                onDelete: 'CASCADE',
            },
            target_type: {
                type: DataTypes.ENUM('goal', 'project', 'area', 'tag'),
                allowNull: false,
            },
            target_id: { type: DataTypes.INTEGER, allowNull: false },
        },
        {
            tableName: 'ltd_lesson_links',
            timestamps: false,
            indexes: [
                {
                    unique: true,
                    fields: ['lesson_id', 'target_type', 'target_id'],
                    name: 'ltd_lesson_links_target_unique',
                },
                { fields: ['target_type', 'target_id'] },
            ],
        }
    );
