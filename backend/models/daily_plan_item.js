const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DailyPlanItem = sequelize.define(
        'DailyPlanItem',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            daily_plan_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'daily_plans', key: 'id' },
                onDelete: 'CASCADE',
            },
            task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            position: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            // Minutes after local midnight; null means the task is on the
            // day's list without a time slot.
            start_minute: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            duration_minutes: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 30,
            },
        },
        {
            tableName: 'daily_plan_items',
            indexes: [
                {
                    fields: ['daily_plan_id', 'task_id'],
                    name: 'daily_plan_items_plan_id_task_id',
                    unique: true,
                },
                { fields: ['task_id'], name: 'daily_plan_items_task_id' },
            ],
        }
    );

    return DailyPlanItem;
};
