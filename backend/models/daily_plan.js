const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const DailyPlan = sequelize.define(
        'DailyPlan',
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
            // The user's local calendar date, not a UTC instant.
            plan_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            // Set by "Start my day". Until then the plan is a draft and Today
            // keeps offering the planner.
            started_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'daily_plans',
            indexes: [
                {
                    fields: ['user_id', 'plan_date'],
                    name: 'daily_plans_user_id_plan_date',
                    unique: true,
                },
            ],
        }
    );

    return DailyPlan;
};
