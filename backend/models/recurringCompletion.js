const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const RecurringCompletion = sequelize.define(
        'RecurringCompletion',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
            },
            completed_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            original_due_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            skipped: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            tableName: 'recurring_completions',
            timestamps: false,
        }
    );

    RecurringCompletion.associate = function (models) {
        RecurringCompletion.belongsTo(models.Task, {
            foreignKey: 'task_id',
            as: 'Task',
        });
    };

    return RecurringCompletion;
};
