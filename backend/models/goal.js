const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Goal = sequelize.define(
        'Goal',
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
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'areas',
                    key: 'id',
                },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            why: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            horizon: {
                // LTD-PATCH(T-401): preserve season while extending the optional planning horizons.
                type: DataTypes.ENUM(
                    'vision',
                    'five_year',
                    'year',
                    'season',
                    'month',
                    'week'
                ),
                allowNull: false,
                defaultValue: 'season',
            },
            // LTD-PATCH(T-401): additive hierarchy and planning dates; progress is a projection.
            parent_goal_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'goals', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            period_start: { type: DataTypes.DATEONLY, allowNull: true },
            period_end: { type: DataTypes.DATEONLY, allowNull: true },
            achieved_at: { type: DataTypes.DATE, allowNull: true },
            target_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM('active', 'achieved', 'paused', 'dropped'),
                allowNull: false,
                defaultValue: 'active',
            },
            color: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: 'goals',
            indexes: [
                // LTD-PATCH(T-401): indexed traversal of the horizon tree.
                {
                    fields: ['parent_goal_id'],
                    name: 'goals_parent_goal_id_idx',
                },
                { fields: ['area_id'] },
                { fields: ['user_id'] },
                { fields: ['status'] },
            ],
        }
    );

    return Goal;
};
